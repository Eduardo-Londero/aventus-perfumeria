"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  /** Ancho máximo que se le pide al servidor al optimizar. */
  maxWidth?: number;
  /**
   * Tamaño óptimo para el lugar donde se muestra esta imagen (px).
   * Se calculó a partir de la relación de aspecto real del contenedor y el
   * ancho máximo que ocupa en pantalla (con pantalla retina incluida).
   */
  recommended?: { width: number; height: number };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function describeSize({ width, height }: { width: number; height: number }) {
  const divisor = gcd(width, height) || 1;
  const orientation =
    width === height ? "cuadrada" : width > height ? "horizontal" : "vertical";
  return { ratio: `${width / divisor}:${height / divisor}`, orientation };
}

/**
 * Campo de imagen del panel de administración
 * ===========================================
 * Acepta dos formas de cargar una foto:
 *
 *  1. **Subir desde la computadora** (botón "Subir foto"): el archivo se manda
 *     a `POST /api/upload`, el servidor lo redimensiona y convierte a WebP
 *     (menor espacio) y guarda en `public/images/`. Devuelve la ruta local
 *     `/images/archivo.webp`, que es lo que queda en el campo.
 *  2. **Pegar un enlace** (input de texto): sirve para imágenes ya publicadas
 *     en internet (p. ej. de Unsplash) o para corregir la ruta a mano.
 */
export default function ImageField({
  label,
  value,
  onChange,
  hint,
  maxWidth = 1400,
  recommended,
}: ImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    // Preview inmediato mientras se sube
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("maxWidth", String(maxWidth));

      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; url?: string; message?: string };

      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.message || "No se pudo subir la imagen");
      }

      onChange(data.url);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la imagen");
      setPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const displaySrc = preview || value || null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="relative w-24 h-24 bg-gray-100 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          {displaySrc ? (
            <Image
              src={displaySrc}
              alt={label}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setPreview(null);
              setError(null);
            }}
            placeholder="https://... o /images/archivo.webp"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Optimizando..." : "Subir foto"}
            </button>
            {value && !preview && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setError(null);
                }}
                className="text-sm text-red-500 hover:text-red-600"
              >
                Quitar
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Tamaño óptimo para este lugar */}
          {recommended && (
            <div className="flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2">
              <svg
                className="w-4 h-4 text-gold-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              <div>
                <p className="text-xs font-semibold text-gold-800">
                  Tamaño óptimo para este lugar: {recommended.width} ×{" "}
                  {recommended.height} px ·{" "}
                  {describeSize(recommended).orientation}{" "}
                  {describeSize(recommended).ratio}
                </p>
                <p className="text-xs text-gold-700">
                  La foto se muestra recortada a esa proporción: si la subís con
                  otra, se cortan los bordes.
                </p>
              </div>
            </div>
          )}

          {hint && <p className="text-xs text-gray-500">{hint}</p>}
          <p className="text-xs text-gray-400">
            JPG/PNG/HEIC hasta 10 MB. Se optimiza sola: se reduce al ancho
            máximo de {maxWidth} px y pasa a WebP.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
