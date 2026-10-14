"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/context/ToastContext";
import { dbHomeSections, HomepageSection } from "@/lib/db";

export default function AdminInicioPage() {
  const { showToast } = useToast();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loaded = dbHomeSections.getAll();
    if (loaded.length === 0) {
      const defaults = dbHomeSections.getDefaultSections();
      dbHomeSections.save(defaults);
      setSections(defaults);
    } else {
      setSections(loaded);
    }
    setIsLoading(false);
  }, []);

  const handleToggle = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
    setHasPendingChanges(true);
  };

  const handleMoveUp = (id: string) => {
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((s) => s.id === id);
      if (index > 0) {
        const temp = sorted[index].order;
        sorted[index].order = sorted[index - 1].order;
        sorted[index - 1].order = temp;
      }
      return sorted;
    });
    setHasPendingChanges(true);
  };

  const handleMoveDown = (id: string) => {
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((s) => s.id === id);
      if (index < sorted.length - 1) {
        const temp = sorted[index].order;
        sorted[index].order = sorted[index + 1].order;
        sorted[index + 1].order = temp;
      }
      return sorted;
    });
    setHasPendingChanges(true);
  };

  const handleApplyChanges = () => {
    if (!hasPendingChanges) return;
    dbHomeSections.save(sections);
    setHasPendingChanges(false);
    showToast("Cambios aplicados correctamente", "success");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inicio (Home)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestioná las secciones de la página principal
          </p>
        </div>
        <button
          onClick={handleApplyChanges}
          disabled={!hasPendingChanges}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasPendingChanges
              ? "bg-gold-600 text-white hover:bg-gold-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          Aplicar cambios
        </button>
      </div>

      {hasPendingChanges && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            Tenés cambios pendientes de aplicar.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Secciones del Home</h2>
        <p className="text-sm text-gray-600 mb-6">
          Activá o desactivá las secciones y ordená su aparición en la página principal.
        </p>

        <div className="space-y-3">
          {sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <div
                key={section.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={section.isActive}
                      onChange={() => handleToggle(section.id)}
                      className="w-5 h-5 rounded accent-gold-600"
                    />
                    <span className={`font-medium ${section.isActive ? "text-gray-900" : "text-gray-500"}`}>
                      {section.title}
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMoveUp(section.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Mover arriba"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(section.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Mover abajo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-500 ml-2">#{section.order}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
