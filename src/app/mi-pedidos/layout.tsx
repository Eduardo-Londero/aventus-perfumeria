import type { Metadata } from "next";

/** Historial de pedidos del cliente: no indexable. */
export const metadata: Metadata = {
  title: "Mis pedidos | Aventus Perfumería",
  robots: { index: false, follow: false },
};

export default function MiPedidosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
