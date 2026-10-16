# TagWitness — Arkiv schema

Network: Tiramisu testnet (chain id 7738577), SDK `@arkiv-network/sdk` 0.8.1. All entities share `app = "tagwitness-v1"`. Content type `application/json`.

## Entity: observation
"Witness W saw `repo@tag` resolve to commit `sha` at time T." Written on first sighting and whenever the SHA changes (unchanged tags are not rewritten).

| attribute | type | example |
|---|---|---|
| app | str | `tagwitness-v1` |
| type | str | `observation` |
| repo | str | `actions/checkout` |
| tag | str | `v4` |
| sha | str | 40-hex commit SHA (annotated tags dereferenced) |
| observed_at | number (unix s) | `1760550000` |

Payload: `{repo, tag, sha, source, observed_at}`. **Expiration: 180 days.** Owner/creator = witness address (identity of the witness).

## Entity: move
"Witness W previously saw `previous_sha`, now sees `sha`." Same attributes as observation plus `previous_sha` (str); `type = "move"`. **Expiration: 365 days** (alerts are kept longer for forensics). A matching `observation` is written alongside so the witness' latest view advances.

## Queries
1. Witness' own last view (CLI, before writing): `app = tagwitness-v1 && type = observation && repo = R && tag = T`, `.createdBy(witness)` → pick max `observed_at`.
2. Full history of a tag across all witnesses (web lookup / workflow check): `app = tagwitness-v1 && type = observation && repo = R && tag = T`, iterated over all pages, selecting `key, attributes, creator`; verdict = number of distinct `sha` values + comparison against GitHub's live ref.
3. Move alerts feed: `app = tagwitness-v1 && type = move`, limit 50, sorted client-side by `observed_at`.

## Wallets
- `0xbC6C7b89D747230251F43cA57b7EBA9fF0EB1D8F` — reference witness run by the author (CLI cron).
- Any browser wallet using "Be a witness" — community witnesses; trust is per-address and visible in the UI.
