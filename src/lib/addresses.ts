import { getSupabase } from "@/lib/supabaseClient";

export interface Address {
  id: string;
  userId: string;
  alias: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  street: string;
  streetNumber: string;
  floorApt: string;
  notes: string;
  isDefault: boolean;
  createdAt: string;
}

function mapRow(row: any): Address {
  return {
    id: row.id,
    userId: row.user_id,
    alias: row.alias || "Dirección",
    recipientName: row.recipient_name || "",
    phone: row.phone || "",
    province: row.province || "",
    city: row.city || "",
    postalCode: row.postal_code || "",
    street: row.street || "",
    streetNumber: row.street_number || "",
    floorApt: row.floor_apt || "",
    notes: row.notes || "",
    isDefault: !!row.is_default,
    createdAt: row.created_at,
  };
}

export async function listAddresses(userId: string): Promise<Address[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createAddress(userId: string, data: Omit<Address, "id" | "userId" | "createdAt">): Promise<Address> {
  const supabase = getSupabase();
  // Si es default, quitar default de las demás
  if (data.isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
  }
  const { data: row, error } = await supabase
    .from("addresses")
    .insert({
      user_id: userId,
      alias: data.alias,
      recipient_name: data.recipientName,
      phone: data.phone,
      province: data.province,
      city: data.city,
      postal_code: data.postalCode,
      street: data.street,
      street_number: data.streetNumber,
      floor_apt: data.floorApt,
      notes: data.notes,
      is_default: data.isDefault,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(row);
}

export async function updateAddress(id: string, data: Partial<Omit<Address, "id" | "userId" | "createdAt">>): Promise<Address> {
  const supabase = getSupabase();
  const patch: any = {};
  if (data.alias !== undefined) patch.alias = data.alias;
  if (data.recipientName !== undefined) patch.recipient_name = data.recipientName;
  if (data.phone !== undefined) patch.phone = data.phone;
  if (data.province !== undefined) patch.province = data.province;
  if (data.city !== undefined) patch.city = data.city;
  if (data.postalCode !== undefined) patch.postal_code = data.postalCode;
  if (data.street !== undefined) patch.street = data.street;
  if (data.streetNumber !== undefined) patch.street_number = data.streetNumber;
  if (data.floorApt !== undefined) patch.floor_apt = data.floorApt;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.isDefault !== undefined) patch.is_default = data.isDefault;

  if (data.isDefault) {
    // quitar default de las demás (se resuelve por user_id del registro)
    const { data: current } = await supabase.from("addresses").select("user_id").eq("id", id).single();
    if (current?.user_id) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", current.user_id).neq("id", id);
    }
  }

  const { data: row, error } = await supabase
    .from("addresses")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(row);
}

export async function deleteAddress(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}