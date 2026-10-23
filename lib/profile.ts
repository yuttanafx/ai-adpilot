import { getDb } from "./db";
import { PROVIDER_IDS, type Provider } from "./providers";

export async function keyStatus(userId: string): Promise<Record<Provider, { set: boolean; last4: string }>> {
  const rows = await (await getDb()).query("select provider, last4 from user_keys where user_id = $1", [userId]);
  const out = {} as Record<Provider, { set: boolean; last4: string }>;
  for (const p of PROVIDER_IDS) {
    const r = rows.find((x) => x.provider === p);
    out[p] = { set: Boolean(r), last4: r ? r.last4 : "" };
  }
  return out;
}
