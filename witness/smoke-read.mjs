import { createPublicClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { and, eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
const pub = createPublicClient({ chain: tiramisu, transport: http() });
console.log("chain", await pub.getChainId());
const r = await pub.select({ key: true, attributes: true, owner: true }).where(and([eq("app", "tagwitness-v1")])).limit(5).fetch();
console.log("entities", r.entities.length, JSON.stringify(r.entities[0] ?? null, (k, v) => typeof v === "bigint" ? v.toString() : v));
