// QR pairing for the room code (vanilla, no framework):
//   • "Show QR"  — renders the typed room code as a QR (server-side SVG via /api/room-qr)
//   • "Scan QR"  — reads the other fan's QR with the camera; decoding is 100% local (jsQR)
//   • ?room=CODE — deep link that auto-fills the room code and connects
// Loaded before app.js. Relies on app.js globals (toast, the #connectForm submit handler),
// which all exist by the time any handler here runs — wiring fires on clicks/DOMContentLoaded.

const $qr = (id) => document.getElementById(id)

/** Accept either a plain room code or a URL carrying ?room=<code> (e.g. a shared deep link). */
function roomFromScan(text) {
  try {
    const room = new URL(text).searchParams.get('room')
    if (room) return room.trim()
  } catch {
    /* not a URL — treat as a plain room code */
  }
  return String(text).trim()
}

// --- show my room code as a QR for the other fan to scan ---
$qr('qrShowBtn').addEventListener('click', () => {
  const room = $qr('roomCode').value.trim()
  if (!room) return toast('Type a room code first')
  const box = $qr('qrBox')
  const img = $qr('qrImg')
  if (!box.hidden && img.dataset.room === room) {
    box.hidden = true // second click on the same code toggles it off
    return
  }
  img.src = '/api/room-qr?room=' + encodeURIComponent(room)
  img.dataset.room = room
  box.hidden = false
})

// --- scan the other fan's QR with the camera ---
let scanStream = null
let scanRaf = 0

function stopScan() {
  cancelAnimationFrame(scanRaf)
  if (scanStream) scanStream.getTracks().forEach((t) => t.stop())
  scanStream = null
  $qr('scanVideo').srcObject = null
  $qr('scanOverlay').hidden = true
}

async function startScan() {
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  } catch {
    return toast('Camera blocked')
  }
  const video = $qr('scanVideo')
  video.srcObject = scanStream
  await video.play().catch(() => {})
  $qr('scanOverlay').hidden = false

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const tick = () => {
    if (!scanStream) return
    if (video.readyState >= 2 && video.videoWidth) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const hit = window.jsQR && jsQR(frame.data, frame.width, frame.height)
      if (hit && hit.data) {
        stopScan()
        $qr('roomCode').value = roomFromScan(hit.data)
        toast('QR scanned ✓ connecting…')
        $qr('connectForm').requestSubmit()
        return
      }
    }
    scanRaf = requestAnimationFrame(tick)
  }
  scanRaf = requestAnimationFrame(tick)
}

$qr('qrScanBtn').addEventListener('click', startScan)
$qr('scanCloseBtn').addEventListener('click', stopScan)

// --- deep link: /?room=CODE auto-fills + connects (handy for scripted demos) ---
window.addEventListener('DOMContentLoaded', () => {
  const room = new URLSearchParams(location.search).get('room')
  if (!room) return
  $qr('roomCode').value = room.trim()
  $qr('connectForm').requestSubmit()
})
