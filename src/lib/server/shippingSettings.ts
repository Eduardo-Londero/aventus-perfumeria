import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export interface ShippingSetting {
  provider: string;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function getShippingSettings(): Promise<ShippingSetting[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("shipping_settings")
    .select("provider, enabled, updated_at, updated_by")
    .order("provider");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    provider: r.provider,
    enabled: r.enabled,
    updatedAt: r.updated_at ?? null,
    updatedBy: r.updated_by ?? null,
  }));
}

export async function setShippingSetting(provider: string, enabled: boolean, actor: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("shipping_settings")
    .upsert({ provider, enabled, updated_at: new Date().toISOString(), updated_by: actor }, { onConflict: "provider" });
  if (error) throw new Error(error.message);
}

export async function isShippingProviderEnabled(provider: string): Promise<boolean> {
  try {
    const settings = await getShippingSettings();
    const s = settings.find((x) => x.provider === provider);
    return s ? s.enabled : true;
  } catch {
    return true; // fail-open si no hay tabla/config
  }
}