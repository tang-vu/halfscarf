# halfscarf — 3-minute demo video storyboard (Tether Developers Cup, first cut)

Judging axes: technical ambition · UX · real-world use · creativity · REAL use of tracks.
Video must show all three tracks working, ≤ 3:00, YouTube unlisted.

## Prep BEFORE recording (10 min)
1. Start both fans (2 terminals):
   `INSTANCE=Alice NATION=Argentina FLAG=🇦🇷 LANG_CODE=es PORT=3001 npm start`
   `INSTANCE=Bob NATION=England FLAG=🏴 LANG_CODE=en PORT=3002 npm start`
2. **Warm the AI**: pair once in any room, hold 🎙️ and say one throwaway phrase on EACH side
   (loads Whisper+Bergamot+TTS so on-camera latency is the warm ~2s, not model-load).
3. Then click into a **fresh room code** field state: reload both tabs WITHOUT `?room=` so the
   pairing scene can be filmed live (pairing takes ~6–9s — it's real, show it).
4. Wallets: `.data/alice.seed` = funded dev wallet (has TestUSDT + gas), Bob has gas-free receive.
   For the tip scene BOB pays ALICE → bob needs gas + tokens; if not funded, swap roles: ALICE tips BOB
   (alice holds ~999k TestUSDT + ETH — safest). Verify balances show before recording.
5. Screen layout: two browser windows side-by-side (Alice left, Bob right), 1080p, hide bookmarks.
   Terminals hidden. Etherscan tab pre-logged-out/clean, closed.
6. Sound: system audio captured (the TTS voice is a wow moment — make sure it's audible in OBS).

## Script (target 2:50)

**[0:00–0:18 — HOOK]** Landing page (halfscarf.vercel.app) hero on screen, scroll slowly once.
VO: "World Cup 2026. Eighty thousand fans, one stadium. Two strangers meet: she speaks Spanish,
he speaks English. No common language, no common currency, and the network is on its knees.
halfscarf fixes all three — with no server, no cloud, and no custodian."

**[0:18–0:35 — CAST]** Cut to the two app windows side by side.
VO: "Two devices, two fans. Each runs halfscarf locally. Each got a self-custodial wallet the
moment it started — the seed never leaves the machine." (Point cursor at the two balances + addresses.)

**[0:35–1:05 — PEARS: pair live]** Type `worldcup-final` on Alice → click *Show QR* (flash it) →
on Bob type the same code (or narrate the QR scan option) → both *Connect over P2P*.
Let the ~8s search run — this is real DHT discovery, say so.
VO: "The room code becomes a hash on Hyperswarm's public DHT. No signalling server, no relay —
watch them find each other… connected. Every byte from here is fan-to-fan, end-to-end encrypted."
Badge lights up, peer cards fill. Send one chat line: "GOOOL 🎉".

**[1:05–1:55 — QVAC: the language wall falls]** Bob holds 🎙️: *"Hello my friend! Welcome to the
World Cup — let me buy you a beer."* → Alice's banner pops in Spanish AND SPEAKS it aloud (pause,
let the audio play on camera).
Alice holds 🎙️: *"¡Gracias! Una cerveza, por favor."* → Bob reads + hears English.
VO: "Whisper transcribes, Bergamot translates — on HIS phone, 1.8 seconds. Supertonic speaks it
on HERS. Three AI models, zero cloud calls, zero API keys. Airplane-mode AI."

**[1:55–2:35 — WDK: settle the bet]** Alice taps 🍺 quick-tip (1 USDT) → sending → Bob's toast
"💸 +1 USDT" pops via the P2P channel → click *view tx ↗* → Etherscan shows the real transfer.
VO: "The tip is a real USDt transfer, signed on her device from a wallet only she holds. The
'you got paid' ping rides the same peer-to-peer link — no backend anywhere."

**[2:35–2:50 — CLOSE]** Back to landing page bottom ("0 servers · 0 cloud AI calls · 0 custodians").
VO: "One meetup, all three tracks: QVAC on-device AI, Pears peer-to-peer, WDK self-custody.
halfscarf — two fans, nothing in common, one scarf. Repo and setup: github.com/tang-vu/halfscarf."

## Don'ts
- Don't film model download (that's why we warm first).
- Don't show terminals with seeds; don't show `.env`.
- Don't cut the TTS audio moment — it's the strongest 5 seconds of the video.
- Keep total ≤ 3:00 — trim the pairing wait with a 2× speed-up if needed (label it "2×").

## Unresolved questions
- Who narrates (live VO vs recorded after)? Either works; recorded-after is easier to time.
