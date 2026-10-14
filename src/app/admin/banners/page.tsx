"use client";

import { useState } from "react";
import Image from "next/image";
import { Banner } from "@/types/cms";
import { useToast } from "@/context/ToastContext";

const mockBanners: Banner[] = [
  {
    id: "1",
    title: "Nueva colección",
    subtitle: "Descubrí las últimas fragancias",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=1920&q=80",
    buttonText: "Ver más",
    buttonLink: "/perfumes",
    startDate: "2024-03-01",
    endDate: "2024-03-31",
    isActive: true,
    order: 1,
    type: "collection",
  },
  {
    id: "2",
    title: "Envío gratis",
    subtitle: "En pedidos superiores a $50.000",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1920&q=80",
    buttonText: "Comprar ahora",
    buttonLink: "/perfumes",
    startDate: "2024-03-01",
    endDate: "2024-12-31",
    isActive: true,
    order: 2,
    type: "promotion",
  },
];

export default function AdminBannersPage() {
  const { showToast } = useToast();
  const [banners, setBanners] = useState<Banner[]>(mockBanners);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDelete = (id: string) => {
    if (confirm("¿Seguro que querés eliminar este banner?")) {
      setBanners((prev) => prev.filter((b) => b.id !== id));
      showToast("Banner eliminado correctamente");
    }
  };

  const handleToggleActive = (id: string) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b))
    );
    showToast("Banner actualizado");
  };

  const handleDuplicate = (banner: Banner) => {
    const newBanner = { ...banner, id: String(Date.now()), title: `${banner.title} (copia)` };
    setBanners((prev) => [...prev, newBanner]);
    showToast("Banner duplicado correctamente");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestioná los banners promocionales
          </p>
        </div>
        <button
          onClick={() => { setEditingBanner(null); setIsModalOpen(true); }}
          className="px-4 py-2 bg-gold-600 text-white text-sm font-medium rounded-lg hover:bg-gold-700 transition-colors"
        >
          + Nuevo banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner) => (
          <div key={banner.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="relative h-48">
              <Image src={banner.image} alt={banner.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="font-serif text-xl text-white">{banner.title}</h3>
                <p className="text-sm text-white/80">{banner.subtitle}</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                <span>Tipo: {banner.type}</span>
                <span>Orden: {banner.order}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(banner.id)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    banner.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {banner.isActive ? "Activo" : "Inactivo"}
                </button>
                <button
                  onClick={() => handleDuplicate(banner)}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Duplicar
                </button>
                <button
                  onClick={() => { setEditingBanner(banner); setIsModalOpen(true); }}
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
