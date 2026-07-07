// halfscarf front-end (vanilla). Talks only to this fan's local Node API (loopback).
// The fan-to-fan link is Hyperswarm, bridged to this page via /api/events (SSE).

const $ = (id) => document.getElementById(id)

let cfg = { usdtDecimals: 6, usdtAddress: '' }
let myAddress = ''
let peer = null // connected peer identity: { name, nation, flag, lang, address }

async function api(path, opts) {
  const res = await fetch(path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function toast(msg) {
  let el = document.querySelector('.toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 1800)
}

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

function logEntry({ kind, html, href, action }) {
  const list = $('logList')
  const empty = list.querySelector('.empty')
  if (empty) empty.remove()
  const li = document.createElement('li')
  li.className = kind
  const time = new Date().toLocaleTimeString()
  li.innerHTML = `<span class="t">${time}</span> ${html}` +
    (href ? ` · <a href="${href}" target="_blank" rel="noopener">view tx ↗</a>` : '')
  if (action) {
    const btn = document.createElement('button')
    btn.className = 'mini pay'
    btn.textContent = action.label
    btn.onclick = action.onClick
    li.appendChild(btn)
  }
  list.prepend(li)
}

async function loadConfig() {
  cfg = await api('/api/config')
  $('youFlag').textContent = cfg.flag || '🏳️'
  $('youName').textContent = cfg.instance || 'Fan'
  $('youNation').textContent = cfg.nation || ''
  document.title = `${cfg.flag || ''} ${cfg.instance || 'halfscarf'}`
  if (cfg.room) $('roomCode').value = cfg.room
  if (!cfg.usdtAddress) toast('USDT_ADDRESS not set in .env')
}

async function refreshWallet() {
  try {
    const w = await api('/api/wallet')
    myAddress = w.address
    $('youUsdt').textContent = w.usdtHuman
    $('youEth').textContent = Number(w.nativeEth).toFixed(4)
    $('youAddr').textContent = w.address
    $('youAddr').title = w.address
  } catch {
    $('youUsdt').textContent = '—'
  }
}

function setP2PBadge(state, peers) {
  const b = $('p2pBadge')
  b.classList.toggle('ok', state === 'connected' && peers > 0)
  b.textContent =
    state === 'connected' && peers > 0 ? '🛰️ P2P: connected'
    : state === 'joining' ? '🛰️ P2P: searching…'
    : '🛰️ P2P: not connected'
}

function showPeer(id) {
  peer = id
  $('pairBox').hidden = true
  $('peerCard').hidden = false
  $('peerFlag').textContent = id.flag || '🏳️'
  $('peerName').textContent = id.name || 'Fan'
  $('peerNation').textContent = id.nation || ''
  $('peerAddr').textContent = id.address
  $('peerAddr').title = id.address
  $('peerNameShort').textContent = id.name || 'them'
}

// --- P2P event stream (SSE) ---
function setupSSE() {
  const es = new EventSource('/api/events')
  es.addEventListener('p2p-status', (e) => {
    const s = JSON.parse(e.data)
    setP2PBadge(s.state, s.peers)
    if (s.state === 'joining') logEntry({ kind: 'sys', html: `Searching for a fan in room “${escapeHtml(s.room)}”…` })
    if (s.state === 'disconnected') logEntry({ kind: 'sys', html: 'Peer disconnected.' })
  })
  es.addEventListener('peer-message', (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'identity') {
      showPeer(m)
      logEntry({ kind: 'sys', html: `Connected to <b>${escapeHtml(m.flag)} ${escapeHtml(m.name)}</b> (${escapeHtml(m.nation)}) over Hyperswarm.` })
      toast('Fan connected ✓')
    } else if (m.type === 'chat') {
      logEntry({ kind: 'chat', html: `<b>${escapeHtml(peer ? peer.name : 'them')}:</b> ${escapeHtml(m.text)}` })
    } else if (m.type === 'payment-request') {
      logEntry({
        kind: 'req',
        html: `${peer ? escapeHtml(peer.flag) : ''} <b>${escapeHtml(peer ? peer.name : 'They')}</b> requests <b>${escapeHtml(m.amount)} USDT</b>${m.note ? ` — ${escapeHtml(m.note)}` : ''}`,
        action: { label: `Pay ${m.amount}`, onClick: () => { $('amount').value = m.amount; $('sendForm').requestSubmit() } },
      })
    } else if (m.type === 'payment-sent') {
      logEntry({ kind: 'recv', html: `💸 Incoming <b>${escapeHtml(m.amount)} USDT</b> from ${escapeHtml(peer ? peer.name : 'peer')}`, href: m.explorer })
      setTimeout(refreshWallet, 1500)
    }
  })
}

// --- actions ---
$('connectForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const room = $('roomCode').value.trim()
  if (!room) return
  $('connectBtn').disabled = true
  $('connectBtn').textContent = 'Connecting…'
  try {
    await api('/api/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room }) })
  } catch (err) {
    toast(err.message)
    $('connectBtn').disabled = false
    $('connectBtn').textContent = 'Connect over P2P →'
  }
})

$('sendForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!peer) return toast('No peer connected')
  const amount = $('amount').value.trim()
  const btn = $('sendBtn')
  btn.disabled = true
  btn.textContent = 'Sending…'
  try {
    const r = await api('/api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: peer.address, amount }) })
    logEntry({ kind: 'sent', html: `Sent <b>${escapeHtml(amount)} USDT</b> to ${escapeHtml(peer.name)}`, href: r.explorer })
    toast('USDt sent ✓')
    $('amount').value = ''
    refreshWallet()
  } catch (err) {
    logEntry({ kind: 'err', html: `Send failed: ${escapeHtml(err.message)}` })
    toast('Send failed')
  } finally {
    btn.disabled = false
    btn.textContent = 'Send USDt →'
  }
})

$('requestBtn').addEventListener('click', async () => {
  if (!peer) return toast('No peer connected')
  const amount = $('amount').value.trim() || '1'
  await api('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount }) })
  logEntry({ kind: 'sys', html: `You requested <b>${escapeHtml(amount)} USDT</b> from ${escapeHtml(peer.name)}` })
  toast('Request sent')
})

$('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = $('chatInput').value.trim()
  if (!text) return
  await api('/api/message', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
  logEntry({ kind: 'chat', html: `<b>You:</b> ${escapeHtml(text)}` })
  $('chatInput').value = ''
})

$('copyAddr').addEventListener('click', async () => {
  if (!myAddress) return
  try {
    await navigator.clipboard.writeText(myAddress)
    toast('Address copied')
  } catch {
    toast(myAddress)
  }
})

// boot
loadConfig().then(refreshWallet)
setupSSE()
setInterval(refreshWallet, 5000)
