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

## Attribute names: camelCase rejected, with a misleading error (SDK 0.8.1, Tiramisu)
- `createEntity` with attribute `observedAt` reverted in `execute()` on `0x4400…0044` with
  `Ident32InvalidByte(8, 0x41)`. The SDK's decoded message says the name charset is
  `"A"-"Z", "a"-"z", …` and that `"A"` is *outside* it — self-contradictory. In practice uppercase
  letters are rejected in attribute names; only lowercase/digits/`.`/`-`/`_` work.
- The revert happens at gas-estimation/simulation time, so it looks like a funding/gas/BTL problem
  at first glance (we checked balance, chain id, expiry before reading the decoded error). The useful
  line is at the *head* of stderr; the tail is a huge ABI-encoded calldata dump.
- No client-side validation: the SDK could reject invalid names before an RPC round-trip.
- Fix: renamed `observedAt`→`observed_at`, `previousSha`→`previous_sha`.

## Query results: `attributes` is an object, not an array
- In 0.8.1, `select({ attributes: true })` returns `attributes` as `{ name: { type, value } }`
  (e.g. `observed_at: { type: "i32", value: 1792119627 }`), while examples/our earlier code assumed
  `[{ key, value }]`. This only surfaced once the first entities existed (`e.attributes.map is not a function`).
- Numeric attributes were inferred as `i32` — fine for unix seconds until 2038, but worth documenting.
