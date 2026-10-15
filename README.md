# TagWitness — tamper-evident history of GitHub Actions tags (Arkiv, Security track)

**Problem.** `uses: owner/action@v4` trusts a *mutable* git tag. In March 2025 attackers re-pointed almost every tag of
`tj-actions/changed-files` to a malicious commit (CVE-2025-30066, 23k+ repos) — see
[issue #2463](https://github.com/tj-actions/changed-files/issues/2463) and the [advisory](https://github.com/tj-actions/changed-files/security/advisories/GHSA-mw4p-6x4p-x5m5).
Once tags were "restored", the only record of what `v45` pointed to *at a given time* lived on GitHub — the same platform that was compromised.
Pinning to SHAs is the advice, but most workflows still use tags, and nobody independently remembers where a tag pointed yesterday.

**Solution.** Independent *witnesses* (a CLI / cron job, or anyone's browser wallet) periodically read tag→commit
mappings from GitHub and write them to Arkiv. Entities are signed by the witness address, timestamped by the chain and
cannot be edited by the action's maintainer, by GitHub, or by us. Anyone can:
- paste a workflow and see, per `uses:` line, whether that tag was ever witnessed pointing elsewhere or differs from GitHub right now;
- look up the full witnessed history of `owner/repo@tag`, by witness;
- browse `move` alerts (a witness saw a tag change commit).

Live app: https://whhhh1500.github.io/tagwitness/ · Schema: [arkiv/schema.md](arkiv/schema.md) · Friction: [arkiv/friction.md](arkiv/friction.md)

## Run it
```bash
npm install
node witness/smoke-read.mjs                      # read-only check against Tiramisu
PK=0x<testnet key> node witness/witness.mjs      # witness everything in witness/watchlist.txt
PK=0x<testnet key> node witness/witness.mjs actions/checkout   # or specific repos
```
Fund the witness address from https://hub.arkiv.network/faucet (Tiramisu, chain 7738577). Optional `GITHUB_TOKEN` raises GitHub API limits; `MAX_TAGS` (default 15) caps tags per repo.
Run it on a cron (e.g. GitHub Actions schedule with the key as a secret) to keep witnessing; only *changes* and first sightings are written.

Web UI: static files in `docs/` (no build step; SDK loaded from esm.sh). `npx serve docs` to run locally.

## Why Arkiv
A Postgres/our-API log is only as trustworthy as its operator; IPFS gives immutability but no queryable index ("all observations of repo X tag Y by any witness"); a subgraph needs a custom contract.
Arkiv gives signed, owner-attributed, queryable records with built-in expiration (observations 180 d, move alerts 365 d) and no server of ours in the trust path.

MIT licensed. Built 16–18 Oct 2026 for the Arkiv Global Tour Stop.
