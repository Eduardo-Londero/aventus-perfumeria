"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useToast } from "@/context/ToastContext";
import { formatPrice } from "@/config/site";
import {
  dbProducts,
  dbCategories,
  dbGenders,
  dbBrands,
  dbOrders,
  generateProductId,
  Product,
} from "@/lib/db";
import { useCatalogSync } from "@/hooks/useCatalogSync";
import ImageField from "@/components/ui/ImageField";

type StockFilter = "all" | "out" | "low" | "available" | "high";
type SortOption = "stock-desc" | "stock-asc" | "name-asc" | "name-desc" | "price-asc" | "price-desc" | "newest";

export default function AdminProductosPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [offerFilter, setOfferFilter] = useState<string>("all");

  useCatalogSync(() => setProducts(dbProducts.getAll()));

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Búsqueda por nombre o marca
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const brand = dbBrands.getById(p.brand);
        return (
          p.name.toLowerCase().includes(q) ||
          (brand?.name || "").toLowerCase().includes(q)
        );
      });
    }

    // Filtro por stock
    switch (stockFilter) {
      case "out":
        result = result.filter((p) => p.stock === 0);
        break;
      case "low":
        result = result.filter((p) => p.stock > 0 && p.stock <= 3);
        break;
      case "available":
        result = result.filter((p) => p.stock > 0);
        break;
      case "high":
        result = result.filter((p) => p.stock > 10);
        break;
    }

    // Filtro por marca
    if (brandFilter !== "all") {
      result = result.filter((p) => p.brand === brandFilter);
    }

    // Filtro por género
    if (genderFilter !== "all") {
      result = result.filter((p) => p.gender === genderFilter);
    }

    // Filtro por categoría
    if (categoryFilter !== "all") {
      result = result.filter((p) => p.categories.includes(categoryFilter));
    }

    // Filtro por estado
    if (statusFilter === "active") {
      result = result.filter((p) => p.isActive);
    } else if (statusFilter === "inactive") {
      result = result.filter((p) => !p.isActive);
    }

    // Filtro por oferta
    if (offerFilter === "on-sale") {
      result = result.filter((p) => p.isOnSale);
    } else if (offerFilter === "new") {
      result = result.filter((p) => p.isNew);
    }

    // Ordenamiento
    switch (sortBy) {
      case "stock-desc":
        result.sort((a, b) => b.stock - a.stock);
        break;
      case "stock-asc":
        result.sort((a, b) => a.stock - b.stock);
        break;
      case "name-asc":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return result;
  }, [products, searchQuery, stockFilter, sortBy, brandFilter, genderFilter, categoryFilter, statusFilter, offerFilter]);

  const handleDelete = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    // Verificar si tiene pedidos asociados
    const hasOrders = dbOrders.getAll().some((o) =>
      o.items.some((item) => item.productId === id)
    );

    if (hasOrders) {
      // Si tiene pedidos, desactivar en lugar de eliminar
      if (confirm("Este producto tiene pedidos asociados. ¿Desea desactivarlo en lugar de eliminarlo?")) {
        dbProducts.update(id, { isActive: false });
        setProducts(dbProducts.getAll());
        showToast("Producto desactivado (tiene pedidos asociados)", "info");
      }
      return;
    }

    if (deleteConfirm === id) {
      dbProducts.delete(id);
      setProducts(dbProducts.getAll());
      setDeleteConfirm(null);
      showToast("Producto eliminado correctamente");
    } else {
      setDeleteConfirm(id);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleSave = (product: Product) => {
    try {
      if (editingProduct) {
        // Edición: se opera sobre el ID del producto seleccionado, nunca sobre uno nuevo.
        dbProducts.update(editingProduct.id, product);
        showToast("Producto actualizado correctamente");
      } else {
        // Alta: el formulario no trae ID, se asigna uno único antes de persistir.
        const id = typeof product.id === "string" && product.id.trim() ? product.id : generateProductId();
        dbProducts.create({ ...product, id });
        showToast("Producto creado correctamente");
      }
      setProducts(dbProducts.getAll());
      setIsModalOpen(false);
    } catch (error) {
      // dbProducts.create valida ID ausente/duplicado y nunca persiste datos inválidos.
      showToast(
        error instanceof Error ? error.message : "No se pudo guardar el producto",
        "error"
      );
    }
  };

  const handleToggleActive = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (product) {
      dbProducts.update(id, { isActive: !product.isActive });
      setProducts(dbProducts.getAll());
      showToast(product.isActive ? "Producto desactivado" : "Producto activado");
    }
  };

  // Stats
  const totalProducts = products.length;
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const available = products.filter((p) => p.stock > 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestioná el catálogo de perfumes
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-gold-600 text-white text-sm font-medium rounded-lg hover:bg-gold-700 transition-colors"
        >
          + Agregar producto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Con stock</p>
          <p className="text-2xl font-bold text-green-600">{available}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Stock bajo</p>
          <p className="text-2xl font-bold text-amber-600">{lowStock}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Sin stock</p>
          <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nombre o marca..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>

          {/* Stock Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="all">Todos</option>
              <option value="out">Sin stock</option>
              <option value="low">Stock bajo (1-3)</option>
              <option value="available">Con stock</option>
              <option value="high">Stock alto (&gt;10)</option>
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="all">Todas</option>
              {dbBrands.getAll().map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Género</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="all">Todos</option>
              {dbGenders.getAll().map((gender) => (
                <option key={gender.id} value={gender.id}>{gender.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="all">Todas</option>
              {dbCategories.getAll().map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          {/* Offer Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select
              value={offerFilter}
              onChange={(e) => setOfferFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="all">Todos</option>
              <option value="on-sale">En oferta</option>
              <option value="new">Nuevos</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ordenar</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="newest">Más recientes</option>
              <option value="stock-desc">Mayor stock</option>
              <option value="stock-asc">Menor stock</option>
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="price-asc">Precio menor a mayor</option>
              <option value="price-desc">Precio mayor a menor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Género</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const brand = dbBrands.getById(product.brand);
                const gender = dbGenders.getById(product.gender);
                return (
                  <tr key={product.id || product.slug || product.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={product.images[0] || ""}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.size}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {brand?.name || product.brand}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {gender?.name || product.gender}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        product.stock === 0 ? "text-red-600" :
                        product.stock <= 3 ? "text-amber-600" :
                        "text-green-600"
                      }`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleActive(product.id)}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                            product.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {product.isActive ? "Activo" : "Inactivo"}
                        </button>
                        {product.isOnSale && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">Oferta</span>
                        )}
                        {product.isNew && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">Nuevo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(product)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Editar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {deleteConfirm === product.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(product.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Eliminar</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => handleDelete(product.id)} className="p-1.5 text-gray-400 hover:text-red-600" title="Eliminar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No se encontraron productos</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProductFormModal
          product={editingProduct}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

function ProductFormModal({
  product,
  onSave,
  onClose,
}: {
  product: Product | null;
  onSave: (product: Product) => void;
  onClose: () => void;
}) {
  const categories = dbCategories.getAll();
  const genders = dbGenders.getAll();
  const brands = dbBrands.getAll();

  const [form, setForm] = useState<Partial<Product>>(
    product || {
      name: "",
      brand: brands[0]?.id || "",
      description: "",
      price: 0,
      categories: [],
      gender: genders[0]?.id || "",
      size: "100 ml",
      concentration: "Eau de Parfum",
      olfactoryFamily: "",
      stock: 0,
      images: ["https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80"],
      notes: { top: [], heart: [], base: [] },
      slug: "",
      isActive: true,
      isOnSale: false,
      isNew: false,
      featured: false,
      createdAt: new Date().toISOString().split("T")[0],
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      slug: form.slug || dbProducts.generateSlug(form.name || ""),
      previousPrice: form.previousPrice,
      discount: form.discount,
      soldCount: form.soldCount || 0,
    } as Product);
  };

  const toggleCategory = (categoryId: string) => {
    const current = form.categories || [];
    setForm({
      ...form,
      categories: current.includes(categoryId)
        ? current.filter((c) => c !== categoryId)
        : [...current, categoryId],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {product ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
              <select value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500">
                <option value="">Seleccionar marca</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
              <input type="number" required value={form.price || 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio anterior</label>
              <input type="number" value={form.previousPrice || ""} onChange={(e) => setForm({ ...form, previousPrice: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
              <input type="number" value={form.stock || 0} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
            </div>
          </div>

          {/* Size & Concentration */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño</label>
              <input type="text" value={form.size || ""} onChange={(e) => setForm({ ...form, size: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" placeholder="100 ml" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concentración</label>
              <select value={form.concentration || ""} onChange={(e) => setForm({ ...form, concentration: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500">
                <option value="Eau de Toilette">Eau de Toilette</option>
                <option value="Eau de Parfum">Eau de Parfum</option>
                <option value="Parfum">Parfum</option>
                <option value="Eau de Cologne">Eau de Cologne</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familia olfativa</label>
              <input type="text" value={form.olfactoryFamily || ""} onChange={(e) => setForm({ ...form, olfactoryFamily: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" placeholder="Amaderado Aromático" />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
            <div className="flex gap-4">
              {genders.map((gender) => (
                <label key={gender.id} className="flex items-center gap-2">
                  <input type="radio" name="gender" value={gender.id} checked={form.gender === gender.id} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="accent-gold-600" />
                  <span className="text-sm text-gray-700">{gender.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categorías / Colecciones</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button key={category.id} type="button" onClick={() => toggleCategory(category.id)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${(form.categories || []).includes(category.id) ? "bg-gold-600 text-white border-gold-600" : "bg-white text-gray-700 border-gray-300 hover:border-gold-500"}`}>
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Image */}
          <div>
            <ImageField
              label="Imagen principal"
              value={form.images?.[0] || ""}
              onChange={(v) => setForm({ ...form, images: [v, ...(form.images || []).slice(1)] })}
              recommended={{ width: 1200, height: 1600 }}
              maxWidth={1200}
              hint="Se ve vertical 3:4 en la tarjeta del catálogo y en la ficha del producto. Fondo blanco, producto centrado."
            />
          </div>

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded accent-gold-600" />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isOnSale ?? false} onChange={(e) => setForm({ ...form, isOnSale: e.target.checked })} className="rounded accent-gold-600" />
              <span className="text-sm text-gray-700">En oferta</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isNew ?? false} onChange={(e) => setForm({ ...form, isNew: e.target.checked })} className="rounded accent-gold-600" />
              <span className="text-sm text-gray-700">Nuevo</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.featured ?? false} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="rounded accent-gold-600" />
              <span className="text-sm text-gray-700">Destacado</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-gold-600 text-white text-sm font-medium rounded-lg hover:bg-gold-700">
              {product ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
