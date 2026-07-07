/**
 * VoiceService — on-device speech translation for one fan, via QVAC (Local AI track).
 *
 * Pipeline per utterance (all on-device, no cloud — see DECISIONS.md, verified in Spike C):
 *   mic PCM (16 kHz mono) --Whisper STT (fan's language)--> source text
 *     --Bergamot NMT (fan lang -> peer lang)--> translated text
 *
 * The reverse direction — the peer's translated words arriving as text — can be HEARD too:
 * `synthesizeSpeech` runs Supertonic TTS in this fan's own language and returns playable WAV.
 *
 * Models are loaded lazily and REUSED across utterances (STT ~1s, translate ~0.35s, TTS a few
 * seconds), so push-to-talk stays snappy. Model constants are looked up dynamically by language.
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

/** Supertonic multilingual TTS emits 16-bit mono PCM at this fixed rate (verified in Spike C). */
const TTS_SAMPLE_RATE = 44100

export class VoiceService {
  private whisperId: string | null = null
  private nmtIds = new Map<string, string>() // "from-to" -> modelId
  private ttsId: string | null = null
  private ttsLoading: Promise<string> | null = null
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
   * Load the multilingual Supertonic TTS model once and reuse it. The voice is fixed to THIS
   * fan's language — incoming translated text is always already in it. Promise-cached so a
   * `warm()` and an early request never double-load the model.
   */
  private ensureTts(): Promise<string> {
    if (!this.ttsLoading) {
      this.ttsLoading = (async () => {
        const model = (QVAC as Record<string, unknown>).TTS_MULTILINGUAL_SUPERTONIC3_Q8_0 as { name: string }
        const id = (await QVAC.loadModel({
          modelSrc: model,
          modelConfig: { ttsEngine: 'supertonic', language: this.srcLang, voice: 'F1', ttsSpeed: 1.05, ttsNumInferenceSteps: 5 },
        })) as string
        this.ttsId = id
        return id
      })()
      this.ttsLoading.catch(() => {
        this.ttsLoading = null // failed load (e.g. download interrupted) — allow a retry
      })
    }
    return this.ttsLoading
  }

  /**
   * Synthesize `text` as speech in THIS fan's language, on-device (Supertonic).
   * Returns a playable WAV (16-bit mono, 44.1 kHz) — used so the peer's translated
   * words are HEARD, not just read.
   */
  async synthesizeSpeech(text: string): Promise<Buffer> {
    const id = await this.ensureTts()
    const result = QVAC.textToSpeech({ modelId: id, text, inputType: 'text', stream: false })
    // Samples cross the Bare-worker RPC boundary as a plain number[] — normalize to Int16Array.
    const samples = (await result.buffer) as ArrayLike<number>
    const pcm = samples instanceof Int16Array ? samples : Int16Array.from(samples)
    return wavFromPcm16(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), TTS_SAMPLE_RATE)
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

  /** Warm the models (STT for speaking, then TTS for hearing) so first use is fast. */
  warm(): void {
    if (!this.loading) {
      this.loading = this.ensureWhisper()
        .then(() => this.ensureTts())
        .then(() => {})
        .catch(() => {})
    }
  }

  async dispose(): Promise<void> {
    const ids = [this.whisperId, this.ttsId, ...this.nmtIds.values()].filter(Boolean) as string[]
    for (const id of ids) {
      try {
        await QVAC.unloadModel({ modelId: id })
      } catch {
        /* ignore */
      }
    }
  }
}
