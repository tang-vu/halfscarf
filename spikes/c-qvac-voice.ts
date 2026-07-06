/**
 * Spike C — QVAC on-device voice translation (the Local AI "wow").
 *
 * Pipeline, 100% on-device (no cloud):
 *   English speech (16 kHz mono WAV) --STT(Whisper)--> English text
 *     --translate(Bergamot en->es)--> Spanish text  [--TTS(Supertonic)--> Spanish speech, optional]
 *
 * Measures end-to-end inference latency on this hardware.
 *
 * Every call below was RECONCILED against the SDK's own shipped examples in
 * node_modules/@qvac/sdk/dist/examples/ (transcription/whispercpp-filesystem,
 * translation/translation-bergamot, tts/supertonic-multilingual) — not guessed:
 *   loadModel({ modelSrc, modelConfig, onProgress }) -> modelId   (modelType inferred from modelSrc)
 *   transcribe({ modelId, audioChunk, metadata: true }) -> segments[] ({ text, startMs, endMs, id })
 *   translate({ modelId, text, modelType: 'nmtcpp-translation', stream: false }) -> { text: Promise<string> }
 *   textToSpeech({ modelId, text, inputType: 'text', stream: false }) -> { buffer: Promise<Int16Array> }
 *   unloadModel({ modelId })
 * Models auto-download on first loadModel and cache to disk (resumable).
 *
 * Run:
 *   npm run spike:qvac            # STT + translate, measure latency
 *   npm run spike:qvac -- --tts   # also synthesize Spanish speech to a WAV
 */

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import {
  loadModel,
  unloadModel,
  transcribe,
  translate,
  textToSpeech,
  WHISPER_TINY,
  BERGAMOT_EN_ES,
  TTS_MULTILINGUAL_SUPERTONIC3_Q8_0,
} from '@qvac/sdk'

const here = path.dirname(fileURLToPath(import.meta.url))
const WAV_IN = path.join(here, 'audio', 'hello-en-16k.wav')
const WAV_OUT = path.join(here, 'audio', 'hello-es-out.wav')
const DO_TTS = process.argv.includes('--tts')
const SUPERTONIC_SAMPLE_RATE = 44100

/** Coarse per-model download progress on stderr. */
function onProgress(label: string) {
  return (p: { percentage: number; downloaded: number; total: number }) => {
    const mb = (n: number) => (n / 1e6).toFixed(1)
    const line = `  ${label} download ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`
    process.stderr.write(process.stderr.isTTY ? `\r${line}   ` : `${line}\n`)
    if (p.percentage >= 100) process.stderr.write('\n')
  }
}

/** Wrap 16-bit mono PCM samples in a minimal WAV container so the output is playable. */
function pcm16ToWav(pcm: Int16Array, sampleRate: number): Buffer {
  const dataLen = pcm.length * 2
  const buf = Buffer.alloc(44 + dataLen)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataLen, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buf.writeUInt16LE(2, 32) // block align
  buf.writeUInt16LE(16, 34) // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataLen, 40)
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], 44 + i * 2)
  return buf
}

async function main() {
  console.log('=== Spike C — QVAC on-device voice translation (en -> es) ===')
  console.log('Input WAV:', WAV_IN, '\n')

  const wallStart = Date.now()

  // 1) Speech -> text (Whisper, on-device). CPU first for a reliable baseline.
  console.log('Loading Whisper (STT)…')
  const whisper = await loadModel({
    modelSrc: WHISPER_TINY,
    modelConfig: { language: 'en', n_threads: 4, contextParams: { use_gpu: false } },
    onProgress: onProgress('whisper'),
  })
  const sttStart = Date.now()
  const segments = await transcribe({ modelId: whisper, audioChunk: WAV_IN, metadata: true })
  const sttMs = Date.now() - sttStart
  const englishText = segments.map((s: { text: string }) => s.text).join('').trim()
  console.log(`\n🎙️  STT (${sttMs} ms): "${englishText}"`)
  await unloadModel({ modelId: whisper })

  // 2) Translate en -> es (Bergamot NMT, on-device)
  console.log('\nLoading Bergamot (en -> es NMT)…')
  const nmt = await loadModel({
    modelSrc: BERGAMOT_EN_ES,
    modelConfig: { engine: 'Bergamot', from: 'en', to: 'es', beamsize: 1, normalize: 1 },
    onProgress: onProgress('bergamot'),
  })
  const trStart = Date.now()
  const trResult = translate({ modelId: nmt, text: englishText, modelType: 'nmtcpp-translation', stream: false })
  const spanishText = (await trResult.text).trim()
  const trMs = Date.now() - trStart
  console.log(`\n🌐  Translate (${trMs} ms): "${spanishText}"`)
  await unloadModel({ modelId: nmt })

  // 3) Text -> speech (optional; heavier model)
  let ttsMs = 0
  if (DO_TTS) {
    console.log('\nLoading Supertonic (multilingual TTS, es)…')
    const tts = await loadModel({
      modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q8_0,
      modelConfig: { ttsEngine: 'supertonic', language: 'es', voice: 'F1', ttsSpeed: 1.05, ttsNumInferenceSteps: 5 },
      onProgress: onProgress('tts'),
    })
    const ttsStart = Date.now()
    const ttsResult = textToSpeech({ modelId: tts, text: spanishText, inputType: 'text', stream: false })
    const pcm = (await ttsResult.buffer) as Int16Array
    ttsMs = Date.now() - ttsStart
    writeFileSync(WAV_OUT, pcm16ToWav(pcm, SUPERTONIC_SAMPLE_RATE))
    console.log(`\n🔊  TTS (${ttsMs} ms): ${pcm.length} samples -> ${WAV_OUT}`)
    await unloadModel({ modelId: tts })
  }

  const wallMs = Date.now() - wallStart
  console.log('\n--- latency (this hardware) ---')
  console.log(`STT infer:        ${sttMs} ms`)
  console.log(`Translate infer:  ${trMs} ms`)
  if (DO_TTS) console.log(`TTS infer:        ${ttsMs} ms`)
  console.log(`Inference total:  ${sttMs + trMs + ttsMs} ms`)
  console.log(`Wall incl. load:  ${wallMs} ms`)
}

main().catch((err) => {
  console.error('\nSpike C failed:', err)
  process.exit(1)
})
