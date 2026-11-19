"use client";

/**
 * Panel de banners (Fase D)
 * =========================
 * Antes este panel vivía en un `useState(mock)`: no había persistencia y el
 * botón "Editar/Nuevo" abría un modal que ni siquiera estaba renderizado.
 *
 * Ahora la colección vive en la base (`banners`, migración 0008) y se guarda
 * COMPLETA con `PUT /api/data/banners` (mismo criterio que Inicio/home_sections:
 * lo que importa es el conjunto: orden + activación + vigencia).
 *
 * Se muestra el estado de cada banner (Vigente / Programado / Vencido /
 * Inactivo) para que se entienda por qué alguno no aparece en la página.
 */

import { useState } from "react";
import Image from "next/image";
import { useToast } from "@/context/ToastContext";
import { dbBanners } from "@/lib/db";
import { Banner } from "@/types/cms";
import { useCatalogSync } from "@/hooks/useCatalogSync";
import ImageField from "@/components/ui/ImageField";
import {
  BANNER_STATUS_LABELS,
  BANNER_TYPES,
  BANNER_TYPE_LABELS,
  bannerStatus,
} from "@/lib/banners";

/** Estado del modal: `form` abierto ⇒ hay algo que guardar/cancelar. */
function blankBanner(order: number): Banner {
  return {
    id: String(Date.now()),
    title: "",
    subtitle: "",
    image: "",
    buttonText: "",
    buttonLink: "",
    startDate: "",
    endDate: "",
    isActive: true,
    order,
    type: "promotion",
  };
}

export default function AdminBannersPage() {
  const { showToast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState<Banner | null>(null);
  const [isNew, setIsNew] = useState(false);

  // El servidor rechazó la escritura ⇒ db.ts revirtió en memoria: acá se
  // vuelve a leer la lista real y se avisa con toast (mensaje del servidor).
  useCatalogSync(() => setBanners(dbBanners.getAll()));

  /** Persiste la colección COMPLETA (write-through optimista). */
  const commit = (next: Banner[], message: string) => {
    dbBanners.save(next);
    setBanners(dbBanners.getAll());
    showToast(message, "success");
  };

  const sorted = () =>
    [...dbBanners.getAll()].sort((a, b) => a.order - b.order);

  const handleToggle = (id: string) => {
    const next = sorted().map((b) =>
      b.id === id ? { ...b, isActive: !b.isActive } : b
    );
    const banner = next.find((b) => b.id === id);
    commit(next, banner?.isActive ? "Banner activado" : "Banner desactivado");
  };

  const handleCreate = () => {
    const nextOrder =
      banners.length === 0
        ? 1
        : Math.max(...banners.map((b) => b.order)) + 1;
    setForm(blankBanner(nextOrder));
    setIsNew(true);
  };

  const handleEdit = (banner: Banner) => {
    setForm(banner);
    setIsNew(false);
  };

  const handleDuplicate = (banner: Banner) => {
    const copy: Banner = {
      ...banner,
      id: String(Date.now()),
      title: `${banner.title} (copia)`,
      order: Math.max(...banners.map((b) => b.order)) + 1,
      // La copia arranca INACTIVA: duplicar no debe publicar de improviso.
      isActive: false,
    };
    commit([...sorted(), copy], "Banner duplicado");
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Seguro que querés eliminar este banner?")) return;
    commit(
      sorted().filter((b) => b.id !== id),
      "Banner eliminado correctamente"
    );
  };

  const handleSaveForm = () => {
    if (!form) return;
    if (!form.title.trim()) {
      showToast("Ingresá un título para el banner", "error");
      return;
    }
    if (
      form.startDate &&
      form.endDate &&
      form.endDate < form.startDate
    ) {
      showToast("La fecha final no puede ser anterior a la inicial", "error");
      return;
    }

    const current = sorted();
    const next = isNew
      ? [...current, form]
      : current.map((b) => (b.id === form.id ? form : b));

    commit(next, isNew ? "Banner creado correctamente" : "Banner actualizado");
    setForm(null);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="text-sm text-gray-500 mt-1">
            Los banners activos y vigentes aparecen en la sección de
            promociones del home (se actualiza en ~30 segundos).
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gold-600 text-white hover:bg-gold-700 transition-colors"
        >
          Nuevo banner
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Banners promocionales
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Activá, ordená y programá las fechas. La sección «Banner
          promocional» de <strong>Inicio</strong> también debe estar activada
          para que se muestre en la portada.
        </p>

        {banners.length === 0 ? (
          <p className="text-sm text-gray-500">
            Todavía no hay banners. Creá el primero con «Nuevo banner».
          </p>
        ) : (
          <div className="space-y-3">
            {sorted().map((banner) => {
              const status = bannerStatus(banner);
              return (
                <div
                  key={banner.id}
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                >
                  <div className="relative w-28 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    {banner.image ? (
                      <Image
                        src={banner.image}
                        alt={banner.title}
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                        Sin imagen
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900 truncate">
                        {banner.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                          status === "active"
                            ? "bg-green-100 text-green-700"
                            : status === "scheduled"
                              ? "bg-blue-100 text-blue-700"
                              : status === "expired"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {BANNER_STATUS_LABELS[status]}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                        {BANNER_TYPE_LABELS[banner.type]}
                      </span>
                    </div>
                    {banner.subtitle && (
                      <p className="text-sm text-gray-500 truncate">
                        {banner.subtitle}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {banner.startDate || banner.endDate
                        ? `Vigencia: ${banner.startDate || "sin inicio"} → ${
                            banner.endDate || "sin fin"
                          }`
                        : "Sin fechas: siempre vigente"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 mr-1">
                      #{banner.order}
                    </span>
                    <button
                      onClick={() => handleToggle(banner.id)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        banner.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {banner.isActive ? "Activo" : "Inactivo"}
                    </button>
                    <button
                      onClick={() => handleEdit(banner)}
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title="Editar"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDuplicate(banner)}
                      className="p-1.5 text-gray-400 hover:text-gold-600"
                      title="Duplicar"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      title="Eliminar"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de alta/edición (antes declarado en el estado pero nunca
          renderizado: por eso "Editar" no hacía nada). */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setForm(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {isNew ? "Nuevo banner" : "Editar banner"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Envío gratis"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtítulo
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) =>
                    setForm({ ...form, subtitle: e.target.value })
                  }
                  placeholder="En pedidos superiores a $50.000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <ImageField
                label="Imagen"
                value={form.image}
                onChange={(v) => setForm({ ...form, image: v })}
                recommended={{ width: 1920, height: 1080 }}
                maxWidth={1920}
                hint="Se muestra en 4:3 en la portada. Sin imagen queda un fondo liso."
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texto del botón
                  </label>
                  <input
                    type="text"
                    value={form.buttonText}
                    onChange={(e) =>
                      setForm({ ...form, buttonText: e.target.value })
                    }
                    placeholder="Ver más"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link del botón
                  </label>
                  <input
                    type="text"
                    value={form.buttonLink}
                    onChange={(e) =>
                      setForm({ ...form, buttonLink: e.target.value })
                    }
                    placeholder="/perfumes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as Banner["type"],
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    {BANNER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {BANNER_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Sin fechas el banner queda siempre vigente mientras esté
                activo.
              </p>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                    className="w-4 h-4 rounded accent-gold-600"
                  />
                  Activo
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  Orden
                  <input
                    type="number"
                    min={1}
                    value={form.order}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        order: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setForm(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveForm}
                className="px-4 py-2 bg-gold-600 text-white text-sm rounded-lg hover:bg-gold-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
