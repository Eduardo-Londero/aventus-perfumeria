"use client";

import { useState } from "react";
import Image from "next/image";

interface ProductGalleryProps {
  images: string[];
  productName: string;
  className?: string;
}

/**
 * Galería de imágenes de producto con imagen principal grande
 * y thumbnails abajo. Estado local para imagen activa.
 */
export default function ProductGallery({
  images,
  productName,
  className = "",
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div
        className={`aspect-[3/4] bg-cream-100 flex items-center justify-center ${className}`}
      >
        <p className="text-charcoal-400 text-sm">Sin imagen</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Imagen principal */}
      <div className="relative aspect-[3/4] bg-cream-100 overflow-hidden group">
        <Image
          src={images[activeIndex]}
          alt={`${productName} - Imagen ${activeIndex + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          priority
        />

        {/* Indicador de imagen */}
        {images.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-charcoal-950/60 text-cream-50 text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              aria-label={`Ver imagen ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              className={[
                "relative w-20 h-24 flex-shrink-0 overflow-hidden border-2 transition-all duration-300",
                index === activeIndex
                  ? "border-gold-500 shadow-md"
                  : "border-cream-200 hover:border-charcoal-300 opacity-60 hover:opacity-100",
              ].join(" ")}
            >
              <Image
                src={image}
                alt={`${productName} - Thumbnail ${index + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
