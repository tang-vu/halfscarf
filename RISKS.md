# RISKS

Open risks, most-likely-to-bite first. Close them out as spikes resolve them.

## Open
1. **QVAC voice API unconfirmed.** Docs show only the text-gen (`loadModel`/`completion`) shape;
   the STT / translate / TTS function names + signatures are not yet in hand. Mitigation: read
   installed `.d.ts` + `examples/` in `node_modules/@qvac/sdk` before writing Spike C. (Blocks Phase 3.)
2. **QVAC install weight / native bindings on Windows.** `@qvac/sdk` pulls whisper.cpp / GGML /
   ONNX native backends. Install size + build success on this Windows box is unknown. Mitigation:
   install in isolation during Spike C; if it fails, capture error and decide Node-vs-Pear + fallback.
3. **QVAC model download.** Models come from a distributed registry and may be large / slow / require
   a fetch step. Mitigation: fetch smallest viable models first; measure download time; cache locally.
4. **WDK is beta (`@tetherto/wdk@1.0.0-beta.13`, `wdk-wallet-evm@1.0.0-beta.15`).** Versions pinned;
   full account API now verified against installed types + a live Sepolia read. Residual risk: minor
   API drift on version bumps. Low.
5. **[ACTIVE BLOCKER] Testnet gas for Spike A's live transfer.** Sepolia faucets are captcha/social-
   gated, so a gas-funded wallet can't be obtained fully autonomously. The read path (address +
   native + ERC-20 balance) is already proven live; only the final `transfer` tx-hash is gated.
   Plan once gas is available: deploy a 6-decimal "test USDT" ERC-20 from the funded wallet, then
   `account.transfer(...)` between two derived accounts (USDt-on-Sepolia has no canonical contract).
   Need from user: a funded Sepolia seed/key (gitignored `.env`) **or** fund a generated dev address.
6. **Vulkan loader warning** ("Registry lookup failed to get layer manifest files"). Benign so far
   (vulkaninfo still enumerates the device) but may affect QVAC GPU inference. Mitigation: confirm
   during Spike C; CPU inference is a fallback.
7. **Pear packaging (Bare runtime) vs Node.** QVAC native bindings may not run under Bare/pear-runtime.
   Per the brief: only attempt Pear packaging if it's clean; otherwise stay on Node and record why.

## Closed
- ~~Do the three SDK packages actually exist / install source?~~ All three confirmed on npm.
- ~~Is the Vulkan runtime present on Windows for QVAC?~~ Yes, Vulkan 1.3.280.
