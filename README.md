# halfscarf ⚽🧣

**A football-fan bridge for World Cup 2026.** Two fans who share *no common language, no
common currency, and no reliable network* connect directly, understand each other, and send
each other money — all from their own devices.

Built for the **Tether Developers Cup**, combining all three tracks:

| Leg of the problem | Track | How halfscarf solves it |
| --- | --- | --- |
| No common language | **QVAC** (Local AI) | On-device voice translation. Fan A speaks; fan B hears/reads their own language. All inference on-device — no cloud. |
| No reliable network | **Pears** (P2P) | The two fans connect directly over Hyperswarm. No server, no relay. |
| No common currency | **WDK** (Wallets) | Fans send each other USDt from self-custodial wallets — buy a beer, split a taxi, tip. |

> Status: **Phase 0 — recon & de-risking spikes.** See `PROGRESS.md` for the live build state.

---

## Requirements

- **Node.js ≥ 22.17** (project developed on v24). Check: `node --version`
- **Windows / macOS / Linux.** QVAC on-device inference needs a Vulkan runtime on
  Windows/Linux (Metal on macOS arm64). Check Windows/Linux with `vulkaninfo --summary`.
- A **Sepolia testnet** wallet with a little test ETH (for gas) to try the payment spike.

## Install

```bash
git clone <this-repo>
cd halfscarf
npm install
```

## Run the Phase 0 spikes

Each spike proves one SDK works on your machine before any product code is written.

```bash
npm run spike:wdk     # Spike A — WDK: load wallet, read USDt balance, send a testnet transfer
npm run spike:swarm   # Spike B — Hyperswarm: two peers exchange a message (run in two terminals)
npm run spike:qvac    # Spike C — QVAC: audio in language A -> STT -> translate -> language B out
```

(The full two-instance demo app arrives in Phase 1+. Run steps will be added here as it lands.)

## Repository layout

```
spikes/        Throwaway Phase-0 spikes proving each SDK (WDK, Hyperswarm, QVAC)
src/           Product code (added from Phase 1 onward)
PROGRESS.md    What's done / what's next  (resume a session from here)
DECISIONS.md   The REAL SDK APIs discovered, versions, runtime choice, measured latency
RISKS.md       Open risks
```

## License

MIT — see [`LICENSE`](./LICENSE).
