// halfscarf front-end (vanilla). Talks only to this fan's local Node API.

const $ = (id) => document.getElementById(id)

let cfg = { usdtDecimals: 6, usdtAddress: '' }
let myAddress = ''

async function api(path, opts) {
  const res = await fetch(path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

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

function short(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
}

async function loadConfig() {
  cfg = await api('/api/config')
  $('youFlag').textContent = cfg.flag || '🏳️'
  $('youName').textContent = cfg.instance || 'Fan'
  $('youNation').textContent = cfg.nation || ''
  document.title = `${cfg.flag || ''} ${cfg.instance || 'halfscarf'}`
  if (!cfg.usdtAddress) {
    $('sendBtn').disabled = true
    $('sendBtn').textContent = 'USDt not configured'
  }
}

async function refreshWallet() {
  try {
    const w = await api('/api/wallet')
    myAddress = w.address
    $('youUsdt').textContent = w.usdtHuman
    $('youEth').textContent = Number(w.nativeEth).toFixed(4)
    $('youAddr').textContent = w.address
    $('youAddr').title = w.address
  } catch (err) {
    $('youUsdt').textContent = '—'
  }
}

function logEntry({ kind, text, href }) {
  const list = $('logList')
  const empty = list.querySelector('.empty')
  if (empty) empty.remove()
  const li = document.createElement('li')
  li.className = kind
  const time = new Date().toLocaleTimeString()
  li.innerHTML = `<span style="color:var(--muted)">${time}</span> — ${text}` +
    (href ? ` · <a href="${href}" target="_blank" rel="noopener">view tx ↗</a>` : '')
  list.prepend(li)
}

async function onSend(e) {
  e.preventDefault()
  const to = $('toAddr').value.trim()
  const amount = $('amount').value.trim()
  const btn = $('sendBtn')
  btn.disabled = true
  btn.textContent = 'Sending…'
  try {
    const r = await api('/api/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, amount }),
    })
    logEntry({ kind: 'sent', text: `Sent <b>${amount} USDT</b> to ${short(to)}`, href: r.explorer })
    toast('USDt sent ✓')
    $('amount').value = ''
    refreshWallet()
  } catch (err) {
    logEntry({ kind: 'err', text: `Send failed: ${err.message}` })
    toast('Send failed')
  } finally {
    btn.disabled = false
    btn.textContent = 'Send USDt →'
  }
}

$('copyAddr').addEventListener('click', async () => {
  if (!myAddress) return
  try {
    await navigator.clipboard.writeText(myAddress)
    toast('Address copied')
  } catch {
    toast(myAddress)
  }
})

$('sendForm').addEventListener('submit', onSend)

// boot
loadConfig().then(refreshWallet)
setInterval(refreshWallet, 4000)
