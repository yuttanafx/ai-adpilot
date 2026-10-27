import { getDb } from "./db";
import { keyProviders } from "./store";
import { PROVIDER_IDS, type Provider } from "./providers";

export async function keyStatus(userId: string): Promise<Record<Provider, { set: boolean; last4: string }>> {
  const rows = await keyProviders(await getDb(), userId);
  const out = {} as Record<Provider, { set: boolean; last4: string }>;
  for (const p of PROVIDER_IDS) {
    const r = rows.find((x) => x.provider === p);
    out[p] = { set: Boolean(r), last4: r ? r.last4 : "" };
  }
  return out;
}
