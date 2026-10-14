import Link from "next/link";
import Image from "next/image";
import { Category } from "@/types";
import { getCategoryProductCount } from "@/lib/seed";

interface CategoryCardProps {
  category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/perfumes?categoria=${category.slug}`}
      className="group relative block aspect-[4/3] overflow-hidden bg-charcoal-900"
    >
      <Image
        src={category.image}
        alt={category.name}
        fill
        className="object-cover opacity-60 group-hover:opacity-40 group-hover:scale-110 transition-all duration-700"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/80 via-charcoal-900/20 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-6">
        <p className="text-[10px] tracking-widest2 uppercase text-gold-400 mb-2">
          {getCategoryProductCount(category.id)} productos
        </p>
        <h3 className="font-serif text-2xl text-white mb-2">{category.name}</h3>
        <p className="text-sm text-white/70 line-clamp-2">{category.description}</p>

        <div className="mt-4 flex items-center gap-2 text-white text-xs font-medium tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span>Ver colección</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
