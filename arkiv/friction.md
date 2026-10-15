# Friction log (SDK @arkiv-network/sdk 0.8.1, viem 2.57.x, Node 20.19, Tiramisu 7738577)

### 1. Faucet cannot be used headlessly
- Expected: a CLI/API way to fund a fresh testnet key (CI witnesses, agents).
- Actual: `POST https://hub.arkiv.network/api/faucet` → `{"error":"Unauthorized"}`; requires GitHub login + captcha in a browser.
- Repro: `curl -X POST https://hub.arkiv.network/api/faucet -H 'content-type: application/json' -d '{"address":"0x…"}'` (2026-10-16).

### 2. README "example key" is empty
- Expected: the quick-test key in the SDK README can create an entity.
- Actual: `0x3d05…7a5e` (address `0xc360B9FB…6cf9`) has balance `0n` on Tiramisu, so the write tutorial fails for newcomers.
- Repro: `publicClient.getBalance({address:"0xc360B9FBB59edDB38042745d315661409Ad16cf9"})`.

### 3. README tutorial assumes Node ≥22 type stripping
- Expected: examples run on current LTS boxes.
- Actual: `node --experimental-strip-types` is not available on Node 20; I wrote plain `.mjs` instead.

### 4. No server-side ordering / "latest per key" query
- Expected: `orderBy(observedAt desc).limit(1)` to get a witness' latest observation.
- Actual: no ordering in the query builder I could find in 0.8.1 typings; I fetch all matches and sort client-side. Fine for small sets, wasteful for long histories.

### 5. Positive notes
- Public reads worked first try from Node and the browser via esm.sh; `createdBy()` made per-witness filtering trivial; async iteration over pages is nice.
