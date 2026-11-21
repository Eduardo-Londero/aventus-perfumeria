"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { hasSupabasePublicConfig } from "@/lib/supabaseClient";
import {
  Address,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "@/lib/addresses";

const emptyForm = {
  alias: "Casa",
  recipientName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  street: "",
  streetNumber: "",
  floorApt: "",
  notes: "",
  isDefault: false,
};

export default function AddressesManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !hasSupabasePublicConfig()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listAddresses(user.id);
      setAddresses(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudieron cargar las direcciones", "error");
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (addr: Address) => {
    setForm({
      alias: addr.alias,
      recipientName: addr.recipientName,
      phone: addr.phone,
      province: addr.province,
      city: addr.city,
      postalCode: addr.postalCode,
      street: addr.street,
      streetNumber: addr.streetNumber,
      floorApt: addr.floorApt,
      notes: addr.notes,
      isDefault: addr.isDefault,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.street.trim() || !form.city.trim() || !form.postalCode.trim()) {
      showToast("Completá calle, ciudad y código postal", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateAddress(editingId, form);
        showToast("Dirección actualizada", "success");
      } else {
        await createAddress(user.id, form);
        showToast("Dirección creada", "success");
      }
      await load();
      resetForm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta dirección?")) return;
    try {
      await deleteAddress(id);
      showToast("Dirección eliminada", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo eliminar", "error");
    }
  };

  const handleSetDefault = async (addr: Address) => {
    try {
      await updateAddress(addr.id, { isDefault: true });
      showToast("Dirección predeterminada actualizada", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo actualizar", "error");
    }
  };

  if (!hasSupabasePublicConfig()) {
    return (
      <div className="text-charcoal-600 text-sm">
        Las direcciones guardadas requieren el backend de Supabase configurado.
      </div>
    );
  }

  if (loading) {
    return <div className="text-charcoal-600 text-sm">Cargando direcciones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-charcoal-900">Mis direcciones</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary text-sm"
        >
          Nueva dirección
        </button>
      </div>

      {addresses.length === 0 && !showForm && (
        <p className="text-charcoal-500 text-sm">No tenés direcciones guardadas.</p>
      )}

      <div className="space-y-3">
        {addresses.map((a) => (
          <div key={a.id} className="border border-charcoal-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-charcoal-900">
                  {a.alias} {a.isDefault && <span className="text-xs text-gold-600">(predeterminada)</span>}
                </p>
                <p className="text-sm text-charcoal-600">
                  {a.recipientName} · {a.phone}
                </p>
                <p className="text-sm text-charcoal-600">
                  {a.street} {a.streetNumber} {a.floorApt && `· ${a.floorApt}`}
                </p>
                <p className="text-sm text-charcoal-600">
                  {a.city}, {a.province} · CP {a.postalCode}
                </p>
                {a.notes && <p className="text-xs text-charcoal-500 mt-1">{a.notes}</p>}
              </div>
              <div className="flex flex-col gap-2">
                {!a.isDefault && (
                  <button onClick={() => handleSetDefault(a)} className="text-xs text-gold-600 hover:text-gold-700">
                    Predeterminada
                  </button>
                )}
                <button onClick={() => handleEdit(a)} className="text-xs text-charcoal-600 hover:text-charcoal-900">
                  Editar
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:text-red-700">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="border border-charcoal-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-charcoal-900">{editingId ? "Editar dirección" : "Nueva dirección"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input-aventus" placeholder="Alias (Casa, Trabajo)" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
            <input className="input-aventus" placeholder="Nombre del destinatario" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
            <input className="input-aventus" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input-aventus" placeholder="Provincia" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            <input className="input-aventus" placeholder="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className="input-aventus" placeholder="Código postal" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            <input className="input-aventus" placeholder="Calle" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            <input className="input-aventus" placeholder="Número" value={form.streetNumber} onChange={(e) => setForm({ ...form, streetNumber: e.target.value })} />
            <input className="input-aventus" placeholder="Piso/Depto" value={form.floorApt} onChange={(e) => setForm({ ...form, floorApt: e.target.value })} />
            <input className="input-aventus" placeholder="Referencias" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal-600">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 accent-gold-600" />
            Marcar como predeterminada
          </label>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={resetForm} className="btn-secondary text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}