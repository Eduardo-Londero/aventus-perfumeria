"use client";

import { useState } from "react";
import { useToast } from "@/context/ToastContext";

export default function AdminNosotrosPage() {
  const { showToast } = useToast();
  const [content, setContent] = useState({
    heroTitle: "Sobre Aventus",
    heroSubtitle: "Fragancias que te representan",
    heroImage: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=1920&q=80",
    historyTitle: "Nuestra historia",
    historyContent: "Aventus Perfumería nació de la pasión por las fragancias y el deseo de acercar a cada persona el perfume perfecto. Creemos que un aroma es más que un accesorio: es una declaración de identidad, un recuerdo, una firma personal.",
    historyImage: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
    proposalTitle: "Nuestra propuesta",
  });

  const handleSave = () => {
    showToast("Contenido de Nosotros actualizado correctamente");
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nosotros</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestioná el contenido de la página Nosotros
        </p>
      </div>

      <div className="space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hero</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={content.heroTitle}
                onChange={(e) => setContent({ ...content, heroTitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
              <input
                type="text"
                value={content.heroSubtitle}
                onChange={(e) => setContent({ ...content, heroSubtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen</label>
              <input
                type="url"
                value={content.heroImage}
                onChange={(e) => setContent({ ...content, heroImage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <p className="text-xs text-gray-500 mt-1">Recomendado: 1920 × 700 px, JPG/WebP</p>
            </div>
          </div>
        </div>

        {/* Historia */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historia</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={content.historyTitle}
                onChange={(e) => setContent({ ...content, historyTitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
              <textarea
                value={content.historyContent}
                onChange={(e) => setContent({ ...content, historyContent: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen</label>
              <input
                type="url"
                value={content.historyImage}
                onChange={(e) => setContent({ ...content, historyImage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <p className="text-xs text-gray-500 mt-1">Recomendado: 800 × 1000 px, JPG/WebP</p>
            </div>
          </div>
        </div>

        {/* Propuesta */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Nuestra propuesta</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={content.proposalTitle}
              onChange={(e) => setContent({ ...content, proposalTitle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-3 bg-gold-600 text-white font-medium rounded-lg hover:bg-gold-700 transition-colors"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
