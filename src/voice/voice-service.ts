/**
 * VoiceService — on-device speech translation for one fan, via QVAC (Local AI track).
 *
 * Pipeline per utterance (all on-device, no cloud — see DECISIONS.md, verified in Spike C):
 *   mic PCM (16 kHz mono) --Whisper STT (fan's language)--> source text
 *     --Bergamot NMT (fan lang -> peer lang)--> translated text
 *
 * Models are loaded lazily and REUSED across utterances (STT ~1s, translate ~0.35s), so
 * push-to-talk stays snappy. Model constants are looked up dynamically by language pair.
 */

import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
// Namespace import so missing model constants surface as a clear runtime error, not an import crash.
import * as QVAC from '@qvac/sdk'

/** Prepend a WAV header to raw 16-bit mono PCM so QVAC can decode it from a file. */
function wavFromPcm16(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

const bergamotFor = (from: string, to: string): { name: string } | undefined =>
  (QVAC as Record<string, unknown>)[`BERGAMOT_${from.toUpperCase()}_${to.toUpperCase()}`] as
    | { name: string }
    | undefined

export interface SpeechResult {
  srcText: string
  dstText: string
}

export class VoiceService {
  private whisperId: string | null = null
  private nmtIds = new Map<string, string>() // "from-to" -> modelId
  private loading: Promise<void> | null = null

  /** @param srcLang this fan's spoken language (e.g. "en", "es") */
  constructor(private srcLang: string) {}

  private async ensureWhisper(): Promise<string> {
    if (this.whisperId) return this.whisperId
    const whisper = (QVAC as Record<string, unknown>).WHISPER_TINY as { name: string }
    this.whisperId = (await QVAC.loadModel({
      modelSrc: whisper,
      modelConfig: { language: this.srcLang, n_threads: 4, contextParams: { use_gpu: false } },
    })) as string
    return this.whisperId
  }

  private async ensureNmt(from: string, to: string): Promise<string> {
    const key = `${from}-${to}`
    const existing = this.nmtIds.get(key)
    if (existing) return existing
    const model = bergamotFor(from, to)
    if (!model) throw new Error(`no on-device translation model for ${from} -> ${to}`)
    const id = (await QVAC.loadModel({
      modelSrc: model,
      modelConfig: { engine: 'Bergamot', from, to, beamsize: 1, normalize: 1 },
    })) as string
    this.nmtIds.set(key, id)
    return id
  }

  /**
   * Transcribe 16 kHz mono PCM and translate into `dstLang`.
   * @param pcm16 raw little-endian Int16 PCM, 16 kHz mono (as captured/downsampled by the browser)
   */
  async translateSpeech(pcm16: Buffer, dstLang: string): Promise<SpeechResult> {
    const wav = wavFromPcm16(pcm16, 16000)
    const tmp = path.join(os.tmpdir(), `hs-voice-${process.pid}-${Date.now()}.wav`)
    writeFileSync(tmp, wav)
    try {
      const whisper = await this.ensureWhisper()
      const segments = (await QVAC.transcribe({ modelId: whisper, audioChunk: tmp, metadata: true })) as Array<{
        text: string
      }>
      const srcText = segments.map((s) => s.text).join('').trim()

      let dstText = srcText
      if (srcText && dstLang && dstLang !== this.srcLang) {
        const nmt = await this.ensureNmt(this.srcLang, dstLang)
        const result = QVAC.translate({ modelId: nmt, text: srcText, modelType: 'nmtcpp-translation', stream: false })
        dstText = (await result.text).trim()
      }
      return { srcText, dstText }
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* best effort */
      }
    }
  }

  /** Optionally warm the STT model so the first utterance is fast. */
  warm(): void {
    if (!this.loading) this.loading = this.ensureWhisper().then(() => {}).catch(() => {})
  }

  async dispose(): Promise<void> {
    const ids = [this.whisperId, ...this.nmtIds.values()].filter(Boolean) as string[]
    for (const id of ids) {
      try {
        await QVAC.unloadModel({ modelId: id })
      } catch {
        /* ignore */
      }
    }
  }
}
