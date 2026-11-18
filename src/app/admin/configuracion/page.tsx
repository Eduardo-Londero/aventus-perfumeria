"use client";

import { useState } from "react";
import { siteConfig } from "@/config/site";
import { useToast } from "@/context/ToastContext";
import { dbProducts, dbCategories, dbBrands, dbGenders, dbOrders, dbHomeSections, getDataBackend } from "@/lib/db";
import { buildDump, collectCollections, downloadDump, describeDump } from "@/lib/exportData";
import type { CartItem } from "@/types";

export default function AdminConfiguracionPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<{
    storeName: string;
    tagline: string;
    description: string;
    whatsapp: string;
    instagram: string;
    contactEmail: string;
    senderName: string;
    emailSubject: string;
    phone: string;
    address: string;
    city: string;
    freeShipping: string;
    shippingCost: string;
  }>({
    storeName: siteConfig.name as string,
    tagline: siteConfig.tagline as string,
    description: siteConfig.description as string,
    whatsapp: siteConfig.whatsapp.number as string,
    instagram: siteConfig.instagram.username as string,
    contactEmail: "consultas@aventus.com",
    senderName: "Aventus Perfumería",
    emailSubject: "Nueva consulta desde la web",
    phone: siteConfig.store.phone as string,
    address: siteConfig.store.address as string,
    city: siteConfig.store.city as string,
    freeShipping: siteConfig.shipping.freeThreshold.toString(),
    shippingCost: siteConfig.shipping.defaultCost.toString(),
  });

  const handleSave = () => {
    // Persistir la configuración de envíos en localStorage para que el motor
    // de precios (src/lib/pricing.ts) y el checkout la tomen de inmediato.
    const free = Number(config.freeShipping);
    const cost = Number(config.shippingCost);
    if (!Number.isFinite(free) || free < 0 || !Number.isFinite(cost) || cost < 0) {
      showToast("Los valores de envío deben ser números válidos y no negativos", "error");
      return;
    }
    try {
      localStorage.setItem("aventus-shipping-config", JSON.stringify({ freeThreshold: free, defaultCost: cost }));
    } catch {
      showToast("No se pudo guardar la configuración", "error");
      return;
    }
    showToast("Configuración de envíos guardada correctamente", "success");
  };

  /**
   * Fase D — exportación de respaldo (un clic). El catálogo sale de la capa
   * db.ts (refleja el backend activo) y el carrito del navegador. El JSON
   * resultante lo importa scripts/import-to-supabase.mjs (dry-run primero).
   */
  const handleExportBackup = () => {
    try {
      const dump = buildDump(
        {
          products: dbProducts.getAll(),
          categories: dbCategories.getAll(),
          brands: dbBrands.getAll(),
          genders: dbGenders.getAll(),
          orders: dbOrders.getAll(),
          homeSections: dbHomeSections.getAll(),
          cart: collectCollections().cart as CartItem[],
        },
        { backend: getDataBackend() }
      );
      const filename = downloadDump(dump);
      showToast(`Respaldo ${filename}: ${describeDump(dump)}`, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo generar el respaldo",
        "error"
      );
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configuración general del sitio
        </p>
      </div>

      <div className="space-y-6">
        {/* Información general */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información general</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del local</label>
              <input
                type="text"
                value={config.storeName}
                onChange={(e) => setConfig({ ...config, storeName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
              <input
                type="text"
                value={config.tagline}
                onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contacto</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email receptor de consultas
              </label>
              <input
                type="email"
                value={config.contactEmail}
                onChange={(e) => setConfig({ ...config, contactEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="consultas@aventus.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Las consultas enviadas desde el formulario de contacto serán dirigidas a este correo.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del remitente
              </label>
              <input
                type="text"
                value={config.senderName}
                onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asunto predeterminado
              </label>
              <input
                type="text"
                value={config.emailSubject}
                onChange={(e) => setConfig({ ...config, emailSubject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                type="text"
                value={config.whatsapp}
                onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <input
                type="text"
                value={config.instagram}
                onChange={(e) => setConfig({ ...config, instagram: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={config.phone}
                onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
        </div>

        {/* Local */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Local físico</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={config.address}
                onChange={(e) => setConfig({ ...config, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={config.city}
                onChange={(e) => setConfig({ ...config, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
        </div>

        {/* Envíos */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Envíos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Envío gratis desde ($)</label>
              <input
                type="number"
                value={config.freeShipping}
                onChange={(e) => setConfig({ ...config, freeShipping: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo de envío ($)</label>
              <input
                type="number"
                value={config.shippingCost}
                onChange={(e) => setConfig({ ...config, shippingCost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
        </div>

        {/* Respaldo de datos (Fase D) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Respaldo de datos</h2>
          <p className="text-sm text-gray-500 mb-4">
            Exporta catálogo, pedidos, home y carrito a un archivo JSON, listo para
            importarlo a Supabase con el script{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">scripts/import-to-supabase.mjs</code>.
            El import primero corre en modo dry-run (sin escribir nada).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportBackup}
              className="px-6 py-3 bg-gold-600 text-white font-medium rounded-lg hover:bg-gold-700 transition-colors"
            >
              Exportar respaldo (JSON)
            </button>
            <span className="text-xs text-gray-400">
              Backend activo: {getDataBackend()}
            </span>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-3 bg-gold-600 text-white font-medium rounded-lg hover:bg-gold-700 transition-colors"
        >
          Guardar configuración
        </button>
      </div>
    </div>
  );
}
