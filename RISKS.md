# RISKS

Open risks, most-likely-to-bite first. Close them out as spikes resolve them.

## Open
1. **WDK is beta (`@tetherto/wdk@1.0.0-beta.13`, `wdk-wallet-evm@1.0.0-beta.15`).** Versions pinned;
   full account API verified against installed types + live Sepolia transfers. Residual risk: minor
   API drift on version bumps. Low.
2. **Vulkan loader warning** ("Registry lookup failed to get layer manifest files"). Benign for the
   shipped CPU inference path (all of STT/NMT/TTS verified on CPU); would only matter if we opt in
   to GPU inference later. Low.
3. **`npm audit`: `tmp` (high) via `solc`.** Dev-only dependency used once by
   `spikes/deploy-test-usdt.ts` to compile TestUSDT; never in the runtime path. The "fix" downgrades
   to solc@0.5 (breaking). Accepted as-is; revisit only if the deploy spike is rerun on a shared box.

## Closed
- ~~Do the three SDK packages actually exist / install source?~~ All three confirmed on npm.
- ~~Is the Vulkan runtime present on Windows for QVAC?~~ Yes, Vulkan 1.3.280.
- ~~QVAC voice API unconfirmed.~~ CLOSED by Spike C + Phases 3–4: STT/translate/TTS signatures
  reconciled against the SDK's shipped examples and verified live (see DECISIONS.md).
- ~~QVAC install weight + partial-install fragility on Windows.~~ CLOSED. A mid-install `ECONNRESET`
  once left `@qvac/translation-nmtcpp` incomplete (runtime `MODULE_NOT_FOUND` in the Bare worker);
  fixed via `--force` reinstall. If it recurs: verify each `@qvac/*` subpackage has its JS files.
- ~~QVAC model download size/speed.~~ CLOSED. Whisper ~tens of MB, Bergamot ~37 MB, Supertonic
  ~127 MB; auto-download on first `loadModel`, cached + resumable after. First run slow, cached fast.
- ~~Testnet gas for Spike A's live transfer.~~ CLOSED. User funded dev wallet #0 with 0.05 Sepolia
  ETH; deployed `TestUSDT` and sent 1.5 USDT via WDK `transfer` (tx `0xb557ecd4…1866a1`). USDt-on-Sepolia
  substitution documented: a self-deployed 6-decimal ERC-20 named "USDT".
- ~~Pear packaging (Bare runtime) vs Node.~~ CLOSED — assessed and intentionally not done: it's a
  port (Bare has no `node:http`/SSE loopback), not a packaging step; QVAC inference already runs
  under Bare. Decision + reasoning recorded in DECISIONS.md.
