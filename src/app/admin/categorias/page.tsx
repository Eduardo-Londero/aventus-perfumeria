"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useToast } from "@/context/ToastContext";
import { dbCategories, dbProducts, Category } from "@/lib/db";

export default function AdminCategoriasPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setCategories(dbCategories.getAll());
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) {
      showToast("Ingresá un nombre", "error");
      return;
    }
    const category: Category = {
      id: newName.toLowerCase().replace(/\s+/g, "-"),
      slug: newName.toLowerCase().replace(/\s+/g, "-"),
      name: newName,
      description: "",
      image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80",
      isActive: true,
      order: categories.length + 1,
    };
    dbCategories.create(category);
    setCategories(dbCategories.getAll());
    setNewName("");
    showToast("Categoría creada correctamente");
  };

  const handleUpdate = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    dbCategories.update(editingCategory.id, editingCategory);
    setCategories(dbCategories.getAll());
    setIsModalOpen(false);
    setEditingCategory(null);
    showToast("Categoría actualizada correctamente");
  };

  const handleToggleActive = (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (category) {
      dbCategories.update(id, { isActive: !category.isActive });
      setCategories(dbCategories.getAll());
      showToast(category.isActive ? "Categoría desactivada" : "Categoría activada");
    }
  };

  const handleDelete = (id: string) => {
    const productCount = dbCategories.getProductCount(id);
    if (productCount > 0) {
      showToast(`No se puede eliminar: tiene ${productCount} productos asociados`, "error");
      return;
    }
    if (confirm("¿Seguro que querés eliminar esta categoría?")) {
      dbCategories.delete(id);
      setCategories(dbCategories.getAll());
      showToast("Categoría eliminada correctamente");
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
        <p className="text-sm text-gray-500 mt-1">Gestioná las categorías y colecciones</p>
      </div>

      {/* Create */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear categoría</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la categoría"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <button onClick={handleCreate} className="px-4 py-2 bg-gold-600 text-white text-sm font-medium rounded-lg hover:bg-gold-700">
            Crear
          </button>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="relative h-40">
              <Image src={category.image} alt={category.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <h3 className="font-serif text-xl text-white">{category.name}</h3>
                <p className="text-sm text-white/80">{dbCategories.getProductCount(category.id)} productos</p>
              </div>
            </div>
            <div className="p-4">
              {category.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{category.description}</p>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleToggleActive(category.id)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${category.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {category.isActive ? "Activa" : "Inactiva"}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingCategory(category); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(category.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Editar categoría</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                placeholder="Nombre"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <textarea
                value={editingCategory.description || ""}
                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                placeholder="Descripción"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <input
                type="url"
                value={editingCategory.image || ""}
                onChange={(e) => setEditingCategory({ ...editingCategory, image: e.target.value })}
                placeholder="URL de imagen"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <p className="text-xs text-gray-500">
                Recomendado: 800 × 1000 px, JPG/WebP, relación 4:5
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleUpdate} className="px-4 py-2 bg-gold-600 text-white text-sm rounded-lg hover:bg-gold-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
