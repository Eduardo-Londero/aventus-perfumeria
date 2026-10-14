"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  products,
  filterProducts,
  sortProducts,
  getUniqueBrands,
  getUniqueSizes,
  getUniqueOlfactoryFamilies,
  getPriceRange,
} from "@/data/products";
import { FilterState, SortOption } from "@/types";
import { formatPrice } from "@/config/site";
import SearchBar from "@/components/products/SearchBar";
import ProductGrid from "@/components/products/ProductGrid";

export const dynamic = "force-dynamic";

const initialFilters: FilterState = {
  search: "",
  categories: [],
  brands: [],
  priceRange: getPriceRange(),
  sizes: [],
  gender: [],
  olfactoryFamily: [],
  onlyOffers: false,
  onlyNew: false,
  onlyInStock: false,
  sortBy: "featured",
};

export default function PerfumesClient() {
  const searchParams = useSearchParams();
  // El parámetro canónico es "categoria". Se acepta "category" como alias legado
  // para que enlaces antiguos no fallen en silencio mostrando todo el catálogo.
  const categoriaParam =
    searchParams.get("categoria") || searchParams.get("category");

  const [filters, setFilters] = useState<FilterState>({
    ...initialFilters,
    categories: categoriaParam ? [categoriaParam] : [],
  });
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const brands = getUniqueBrands();
  const sizes = getUniqueSizes();
  const olfactoryFamilies = getUniqueOlfactoryFamilies();
  const [minPrice, maxPrice] = getPriceRange();

  const filteredProducts = useMemo(() => {
    let result = filterProducts({
      categories: filters.categories,
      brands: filters.brands,
      genders: filters.gender,
      sizes: filters.sizes,
      olfactoryFamilies: filters.olfactoryFamily,
      onlyOffers: filters.onlyOffers,
      onlyNew: filters.onlyNew,
      onlyInStock: filters.onlyInStock,
      priceRange: filters.priceRange,
    });

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.olfactoryFamily.toLowerCase().includes(q)
      );
    }

    return sortProducts(result, filters.sortBy);
  }, [filters]);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleArrayFilter = useCallback(
    <K extends "categories" | "brands" | "sizes" | "gender" | "olfactoryFamily">(
      key: K,
      value: string
    ) => {
      setFilters((prev) => {
        const arr = prev[key] as string[];
        const newArr = arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value];
        return { ...prev, [key]: newArr };
      });
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const activeFiltersCount =
    filters.categories.length +
    filters.brands.length +
    filters.sizes.length +
    filters.gender.length +
    filters.olfactoryFamily.length +
    (filters.onlyOffers ? 1 : 0) +
    (filters.onlyNew ? 1 : 0) +
    (filters.onlyInStock ? 1 : 0);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "featured", label: "Destacados" },
    { value: "best-sellers", label: "Más vendidos" },
    { value: "price-asc", label: "Precio: menor a mayor" },
    { value: "price-desc", label: "Precio: mayor a menor" },
    { value: "newest", label: "Más recientes" },
  ];

  const FilterSection = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="border-b border-charcoal-100 pb-6 mb-6">
      <h3 className="text-sm font-medium tracking-widest uppercase text-charcoal-900 mb-4">
        {title}
      </h3>
      {children}
    </div>
  );

  const CheckboxItem = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: () => void;
  }) => (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 border border-charcoal-300 rounded-sm accent-gold-600"
      />
      <span className="text-sm text-charcoal-600 group-hover:text-charcoal-900 transition-colors">
        {label}
      </span>
    </label>
  );

  const FiltersContent = (
    <div>
      {/* Search */}
      <FilterSection title="Buscar">
        <SearchBar
          onSearch={(q) => updateFilter("search", q)}
          placeholder="Buscar perfumes..."
        />
      </FilterSection>

      {/* Categories */}
      <FilterSection title="Categoría">
        {["hombre", "mujer", "unisex"].map((cat) => (
          <CheckboxItem
            key={cat}
            label={cat.charAt(0).toUpperCase() + cat.slice(1)}
            checked={filters.categories.includes(cat)}
            onChange={() => toggleArrayFilter("categories", cat)}
          />
        ))}
      </FilterSection>

      {/* Gender */}
      <FilterSection title="Género">
        {["Masculino", "Femenino", "Unisex"].map((g) => (
          <CheckboxItem
            key={g}
            label={g}
            checked={filters.gender.includes(g)}
            onChange={() => toggleArrayFilter("gender", g)}
          />
        ))}
      </FilterSection>

      {/* Brands */}
      <FilterSection title="Marca">
        {brands.map((brand) => (
          <CheckboxItem
            key={brand}
            label={brand}
            checked={filters.brands.includes(brand)}
            onChange={() => toggleArrayFilter("brands", brand)}
          />
        ))}
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="Precio">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-charcoal-600">
            <span>{formatPrice(filters.priceRange[0])}</span>
            <span>{formatPrice(filters.priceRange[1])}</span>
          </div>
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step={5000}
            value={filters.priceRange[1]}
            onChange={(e) =>
              updateFilter("priceRange", [
                filters.priceRange[0],
                Number(e.target.value),
              ])
            }
            className="w-full accent-gold-600"
          />
        </div>
      </FilterSection>

      {/* Sizes */}
      <FilterSection title="Tamaño">
        {sizes.map((size) => (
          <CheckboxItem
            key={size}
            label={size}
            checked={filters.sizes.includes(size)}
            onChange={() => toggleArrayFilter("sizes", size)}
          />
        ))}
      </FilterSection>

      {/* Olfactory Family */}
      <FilterSection title="Familia olfativa">
        {olfactoryFamilies.map((family) => (
          <CheckboxItem
            key={family}
            label={family}
            checked={filters.olfactoryFamily.includes(family)}
            onChange={() => toggleArrayFilter("olfactoryFamily", family)}
          />
        ))}
      </FilterSection>

      {/* Toggles */}
      <FilterSection title="Opciones">
        <CheckboxItem
          label="Solo ofertas"
          checked={filters.onlyOffers}
          onChange={() => updateFilter("onlyOffers", !filters.onlyOffers)}
        />
        <CheckboxItem
          label="Solo nuevos"
          checked={filters.onlyNew}
          onChange={() => updateFilter("onlyNew", !filters.onlyNew)}
        />
        <CheckboxItem
          label="Solo en stock"
          checked={filters.onlyInStock}
          onChange={() => updateFilter("onlyInStock", !filters.onlyInStock)}
        />
      </FilterSection>

      {/* Reset */}
      {activeFiltersCount > 0 && (
        <button
          onClick={resetFilters}
          className="w-full py-3 border border-charcoal-200 text-sm font-medium tracking-wide text-charcoal-600 hover:border-charcoal-900 hover:text-charcoal-900 transition-all"
        >
          Limpiar filtros ({activeFiltersCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-charcoal-950 text-cream-50 py-16">
        <div className="container-aventus">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
            Catálogo
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">Perfumes</h1>
          <p className="text-cream-50/70 max-w-2xl">
            Explorá nuestra colección completa de fragancias originales.
            Encontrá tu próximo perfume entre las mejores marcas del mundo.
          </p>
        </div>
      </div>

      <div className="container-aventus py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Filters (Desktop) - Independent scroll */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 scrollbar-thin">
              {FiltersContent}
            </div>
          </aside>

          {/* Main Content - Independent scroll */}
          <div className="flex-1 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2 lg:scrollbar-thin">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                {/* Mobile filter button */}
                <button
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-charcoal-200 text-sm font-medium text-charcoal-700 hover:border-charcoal-900 transition-colors"
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
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="w-5 h-5 bg-gold-600 text-white text-xs rounded-full flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                <p className="text-sm text-charcoal-600">
                  <span className="font-medium text-charcoal-900">
                    {filteredProducts.length}
                  </span>{" "}
                  {filteredProducts.length === 1 ? "producto" : "productos"}
                </p>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-charcoal-600">Ordenar:</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    updateFilter("sortBy", e.target.value as SortOption)
                  }
                  className="px-3 py-2 border border-charcoal-200 text-sm text-charcoal-900 bg-white focus:outline-none focus:border-gold-500"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mobile Filters Modal */}
            {isMobileFiltersOpen && (
              <div className="fixed inset-0 z-[80] lg:hidden">
                <div
                  className="absolute inset-0 bg-charcoal-950/50"
                  onClick={() => setIsMobileFiltersOpen(false)}
                />
                <div className="absolute top-0 left-0 bottom-0 w-full max-w-sm bg-cream-50 overflow-y-auto p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif text-xl">Filtros</h2>
                    <button
                      onClick={() => setIsMobileFiltersOpen(false)}
                      className="p-2 text-charcoal-600"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  {FiltersContent}
                  <button
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="w-full btn-primary mt-6"
                  >
                    Ver {filteredProducts.length} productos
                  </button>
                </div>
              </div>
            )}

            {/* Products Grid */}
            {filteredProducts.length > 0 ? (
              <ProductGrid products={filteredProducts} columns={3} />
            ) : (
              <div className="text-center py-20">
                <svg
                  className="w-16 h-16 text-charcoal-200 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="font-serif text-2xl text-charcoal-900 mb-2">
                  No se encontraron productos
                </h3>
                <p className="text-charcoal-500 mb-6">
                  Probá ajustando los filtros o buscando algo diferente.
                </p>
                <button onClick={resetFilters} className="btn-secondary">
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
