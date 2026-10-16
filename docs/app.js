import { createPublicClient, createWalletClient } from "https://esm.sh/@arkiv-network/sdk@0.8.1";
import { tiramisu } from "https://esm.sh/@arkiv-network/sdk@0.8.1/chains";
import { and, eq } from "https://esm.sh/@arkiv-network/sdk@0.8.1/query";
import { ExpirationTime, jsonToPayload } from "https://esm.sh/@arkiv-network/sdk@0.8.1/utils";
import { http, custom } from "https://esm.sh/viem@2";

const APP = "tagwitness-v1";
const pub = createPublicClient({ chain: tiramisu, transport: http() });
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// SDK 0.8.1 returns attributes as { name: { type, value } }
const attrs = e => { const A = e.attributes || {}; return Array.isArray(A) ? Object.fromEntries(A.map(a => [a.key, a.value])) : Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v && typeof v === "object" && "value" in v ? v.value : v])); };
const short = s => s ? s.slice(0, 10) : "";
const t = s => new Date(Number(s) * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";

async function history(repo, tag) {
  const out = [];
  for await (const e of pub.select({ key: true, attributes: true, creator: true })
    .where(and([eq("app", APP), eq("type", "observation"), eq("repo", repo), eq("tag", tag)]))) {
    out.push({ ...attrs(e), witness: e.creator, key: e.key });
    if (out.length > 500) break;
  }
  return out.sort((a, b) => Number(a.observed_at) - Number(b.observed_at));
}
async function liveSha(repo, tag) {
  const r = await fetch(`https://api.github.com/repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`);
  if (!r.ok) return null;
  let o = (await r.json()).object;
  if (o.type === "tag") o = (await (await fetch(o.url)).json()).object; // annotated tag -> commit
  return o.sha;
}
function verdict(h, live) {
  const shas = [...new Set(h.map(x => x.sha))];
  const witnesses = new Set(h.map(x => x.witness)).size;
  if (!h.length) return `<span class="warn">no witness history</span>`;
  if (shas.length > 1) return `<span class="bad">TAG MOVED — ${shas.length} different commits witnessed</span>`;
  if (live && live !== shas[0]) return `<span class="bad">LIVE TAG DIFFERS from witnessed ${short(shas[0])} (now ${short(live)})</span>`;
  return `<span class="ok">stable</span> · ${h.length} observation(s) by ${witnesses} witness(es), first ${t(h[0].observed_at)}`;
}
function parseRef(s) { const m = s.trim().match(/^([\w.-]+\/[\w.-]+)(?:\/[^@]*)?@(.+)$/); return m ? { repo: m[1], tag: m[2] } : null; }

$("lookup").onclick = async () => {
  const r = parseRef($("ref").value); if (!r) return ($("refOut").textContent = "format: owner/repo@tag");
  $("refOut").textContent = "querying Arkiv…";
  const [h, live] = await Promise.all([history(r.repo, r.tag), liveSha(r.repo, r.tag)]);
  $("refOut").innerHTML = `<p>${verdict(h, live)} · live GitHub: <code>${short(live) || "?"}</code></p><table><tr><th>observed</th><th>sha</th><th>witness</th></tr>` +
    h.map(x => `<tr><td>${t(x.observed_at)}</td><td>${short(x.sha)}</td><td>${short(x.witness)}…</td></tr>`).join("") + "</table>";
};
$("checkYaml").onclick = async () => {
  const refs = [...$("yaml").value.matchAll(/uses:\s*["']?([^\s"'#]+)/g)].map(m => m[1]).filter(u => !u.startsWith("./") && !u.startsWith("docker://"));
  $("yamlOut").textContent = "checking " + refs.length + " action(s)…";
  const rows = await Promise.all(refs.map(async u => {
    const r = parseRef(u); if (!r) return `<tr><td>${esc(u)}</td><td>?</td></tr>`;
    if (/^[0-9a-f]{40}$/.test(r.tag)) return `<tr><td>${esc(u)}</td><td class="ok">pinned to full SHA</td></tr>`;
    const [h, live] = await Promise.all([history(r.repo, r.tag), liveSha(r.repo, r.tag)]);
    return `<tr><td>${esc(u)}</td><td>${verdict(h, live)}</td></tr>`;
  }));
  $("yamlOut").innerHTML = `<table>${rows.join("")}</table>`;
};
$("moves").onclick = async () => {
  const r = await pub.select({ attributes: true, creator: true }).where(and([eq("app", APP), eq("type", "move")])).limit(50).fetch();
  const m = r.entities.map(e => ({ ...attrs(e), witness: e.creator })).sort((a, b) => b.observed_at - a.observed_at);
  $("movesOut").innerHTML = m.length ? `<table>${m.map(x => `<tr><td>${t(x.observed_at)}</td><td>${esc(x.repo)}@${esc(x.tag)}</td><td class="bad">${short(x.previous_sha)} → ${short(x.sha)}</td><td>${short(x.witness)}…</td></tr>`).join("")}</table>` : "no moves witnessed (good!)";
};
$("witness").onclick = async () => {
  try {
    if (!window.ethereum) throw new Error("no injected wallet");
    const r = parseRef($("wref").value); if (!r) throw new Error("format owner/repo@tag");
    const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
    try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + tiramisu.id.toString(16) }] }); }
    catch { await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x" + tiramisu.id.toString(16), chainName: "Arkiv Tiramisu", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: tiramisu.rpcUrls.default.http }] }); }
    const sha = await liveSha(r.repo, r.tag); if (!sha) throw new Error("tag not found on GitHub");
    const prev = (await history(r.repo, r.tag)).filter(x => x.witness.toLowerCase() === address.toLowerCase()).pop();
    const wal = createWalletClient({ chain: tiramisu, transport: custom(window.ethereum), account: address });
    const now = Math.floor(Date.now() / 1000);
    const base = { app: APP, repo: r.repo, tag: r.tag, sha, observed_at: now };
    if (prev && prev.sha !== sha) await wal.createEntity({ payload: jsonToPayload({ ...base, previous_sha: prev.sha }), contentType: "application/json", attributes: { ...base, type: "move", previous_sha: prev.sha }, expires: ExpirationTime.fromDays(365) });
    const { entityKey } = await wal.createEntity({ payload: jsonToPayload(base), contentType: "application/json", attributes: { ...base, type: "observation" }, expires: ExpirationTime.fromDays(180) });
    $("wOut").innerHTML = `<span class="ok">recorded</span> ${esc(r.repo)}@${esc(r.tag)} = ${short(sha)} · entity <code>${short(entityKey)}…</code>`;
  } catch (e) { $("wOut").innerHTML = `<span class="bad">${esc(e.shortMessage || e.message)}</span>`; }
};
