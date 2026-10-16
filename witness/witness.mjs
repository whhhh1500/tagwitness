// TagWitness witness: records which commit SHA each GitHub Actions tag points to, on Arkiv.
// Usage: PK=0x... node witness/witness.mjs [owner/repo ...]   (or set WATCHLIST file)
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { and, eq } from "@arkiv-network/sdk/query";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

const APP = "tagwitness-v1";
const pk = process.env.PK;
if (!pk) { console.error("Set PK (testnet key, never commit it)"); process.exit(1); }
const account = privateKeyToAccount(pk);
const pub = createPublicClient({ chain: tiramisu, transport: http() });
const wal = createWalletClient({ chain: tiramisu, transport: http(), account });

let repos = process.argv.slice(2);
if (!repos.length) repos = readFileSync(new URL("./watchlist.txt", import.meta.url), "utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"));
const MAX_TAGS = Number(process.env.MAX_TAGS || 15);
const gh = { headers: { accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } };

async function tagsOf(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=${MAX_TAGS}`, gh);
  if (!r.ok) throw new Error(`${repo}: GitHub ${r.status}`);
  return (await r.json()).map(t => ({ tag: t.name, sha: t.commit.sha }));
}

// last observation THIS witness made for repo@tag
async function lastSeen(repo, tag) {
  const res = await pub.select({ key: true, attributes: true })
    .where(and([eq("app", APP), eq("type", "observation"), eq("repo", repo), eq("tag", tag)]))
    .createdBy(account.address).limit(50).fetch();
  let best = null;
  for (const e of res.entities) {
    const a = attrsOf(e);
    if (!best || Number(a.observed_at) > Number(best.observed_at)) best = a;
  }
  return best;
}

// SDK 0.8.1 returns attributes as { name: { type, value } }, not [{ key, value }]
function attrsOf(e) {
  const A = e.attributes || {};
  return Array.isArray(A) ? Object.fromEntries(A.map(x => [x.key, x.value])) : Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v && typeof v === "object" && "value" in v ? v.value : v]));
}

const now = Math.floor(Date.now() / 1000);
for (const repo of repos) {
  const tags = await tagsOf(repo);
  for (const { tag, sha } of tags) {
    const prev = await lastSeen(repo, tag);
    if (prev && prev.sha === sha) { console.log(`= ${repo}@${tag} ${sha.slice(0, 10)}`); continue; }
    const moved = prev && prev.sha !== sha;
    const { entityKey, txHash } = await wal.createEntity({
      payload: jsonToPayload({ repo, tag, sha, previous_sha: moved ? prev.sha : null, source: "api.github.com/repos/:repo/tags", observed_at: now }),
      contentType: "application/json",
      attributes: { app: APP, type: moved ? "move" : "observation", repo, tag, sha, observed_at: now, ...(moved ? { previous_sha: prev.sha } : {}) },
      expires: ExpirationTime.fromDays(moved ? 365 : 180),
    });
    // a "move" also gets an observation so lastSeen() advances
    if (moved) await wal.createEntity({
      payload: jsonToPayload({ repo, tag, sha, observed_at: now }), contentType: "application/json",
      attributes: { app: APP, type: "observation", repo, tag, sha, observed_at: now }, expires: ExpirationTime.fromDays(180),
    });
    console.log(`${moved ? "!! MOVED" : "+ new"} ${repo}@${tag} ${sha.slice(0, 10)} entity=${entityKey} tx=${txHash}`);
  }
}
