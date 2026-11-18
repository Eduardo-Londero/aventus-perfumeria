"use client";

import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { dbGenders, dbProducts, Gender } from "@/lib/db";
import { useCatalogSync } from "@/hooks/useCatalogSync";

export default function AdminGenerosPage() {
  const { showToast } = useToast();
  const [genders, setGenders] = useState<Gender[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGender, setEditingGender] = useState<Gender | null>(null);
  const [newName, setNewName] = useState("");

  useCatalogSync(() => setGenders(dbGenders.getAll()));

  const handleCreate = () => {
    if (!newName.trim()) {
      showToast("Ingresá un nombre", "error");
      return;
    }
    const gender: Gender = {
      id: newName.toLowerCase().replace(/\s+/g, "-"),
      name: newName,
      isActive: true,
    };
    dbGenders.create(gender);
    setGenders(dbGenders.getAll());
    setNewName("");
    showToast("Género creado correctamente");
  };

  const handleUpdate = () => {
    if (!editingGender || !editingGender.name.trim()) return;
    dbGenders.update(editingGender.id, { name: editingGender.name });
    setGenders(dbGenders.getAll());
    setIsModalOpen(false);
    setEditingGender(null);
    showToast("Género actualizado correctamente");
  };

  const handleToggleActive = (id: string) => {
    const gender = genders.find((g) => g.id === id);
    if (gender) {
      dbGenders.update(id, { isActive: !gender.isActive });
      setGenders(dbGenders.getAll());
      showToast(gender.isActive ? "Género desactivado" : "Género activado");
    }
  };

  const handleDelete = (id: string) => {
    const productCount = dbGenders.getProductCount(id);
    if (productCount > 0) {
      showToast(`No se puede eliminar: tiene ${productCount} productos asociados`, "error");
      return;
    }
    if (confirm("¿Seguro que querés eliminar este género?")) {
      dbGenders.delete(id);
      setGenders(dbGenders.getAll());
      showToast("Género eliminado correctamente");
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Géneros</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestioná los géneros de los perfumes
        </p>
      </div>

      {/* Create */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear género</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del género"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-gold-600 text-white text-sm font-medium rounded-lg hover:bg-gold-700"
          >
            Crear
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {genders.map((gender) => (
              <tr key={gender.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{gender.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{dbGenders.getProductCount(gender.id)}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleActive(gender.id)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded ${gender.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {gender.isActive ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingGender(gender); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(gender.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingGender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Editar género</h3>
            <input
              type="text"
              value={editingGender.name}
              onChange={(e) => setEditingGender({ ...editingGender, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 mb-4"
            />
            <div className="flex justify-end gap-3">
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
