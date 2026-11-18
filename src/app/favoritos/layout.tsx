import type { Metadata } from "next";

/** Lista personal de favoritos: no indexable. */
export const metadata: Metadata = {
  title: "Favoritos | Aventus Perfumería",
  robots: { index: false, follow: false },
};

export default function FavoritosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
