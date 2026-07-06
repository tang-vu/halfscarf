# RISKS

Open risks, most-likely-to-bite first. Close them out as spikes resolve them.

## Open
1. **QVAC voice API unconfirmed.** Docs show only the text-gen (`loadModel`/`completion`) shape;
   the STT / translate / TTS function names + signatures are not yet in hand. Mitigation: read
   installed `.d.ts` + `examples/` in `node_modules/@qvac/sdk` before writing Spike C. (Blocks Phase 3.)
2. **QVAC install weight + partial-install fragility on Windows.** `@qvac/sdk` pulls ~20 `@qvac/*`
   native backend subpackages (whisper.cpp, nmtcpp, tts-ggml, llama.cpp…). Large download; a mid-way
   `ECONNRESET` left `@qvac/translation-nmtcpp` **incomplete** (missing `package.json`/`addonLogging.js`),
   which surfaced only at runtime as a Bare-worker `MODULE_NOT_FOUND`. Mitigation: `--force` reinstall of
   `@qvac`; verify each subpackage has its JS files before running. Consider committing an install-verify step.
   NOTE (useful): QVAC runs inference in a **Bare worker process** (`bare:/…`), not Node — a strong signal
   the AI path can run under Pears/Bare, feeding the Phase-2/3 "package as a Pear app" decision.
3. **QVAC model download.** Models come from a distributed registry and may be large / slow / require
   a fetch step. Mitigation: fetch smallest viable models first; measure download time; cache locally.
4. **WDK is beta (`@tetherto/wdk@1.0.0-beta.13`, `wdk-wallet-evm@1.0.0-beta.15`).** Versions pinned;
   full account API now verified against installed types + a live Sepolia read. Residual risk: minor
   API drift on version bumps. Low.
5. ~~**Testnet gas for Spike A's live transfer.**~~ CLOSED. User funded dev wallet #0 with 0.05 Sepolia
   ETH; deployed `TestUSDT` and sent 1.5 USDT via WDK `transfer` (tx `0xb557ecd4…1866a1`). USDt-on-Sepolia
   substitution documented: a self-deployed 6-decimal ERC-20 named "USDT".
6. **Vulkan loader warning** ("Registry lookup failed to get layer manifest files"). Benign so far
   (vulkaninfo still enumerates the device) but may affect QVAC GPU inference. Mitigation: confirm
   during Spike C; CPU inference is a fallback.
7. **Pear packaging (Bare runtime) vs Node.** QVAC native bindings may not run under Bare/pear-runtime.
   Per the brief: only attempt Pear packaging if it's clean; otherwise stay on Node and record why.

## Closed
- ~~Do the three SDK packages actually exist / install source?~~ All three confirmed on npm.
- ~~Is the Vulkan runtime present on Windows for QVAC?~~ Yes, Vulkan 1.3.280.
