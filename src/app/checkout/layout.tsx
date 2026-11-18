import type { Metadata } from "next";

/** Transacción en curso: no indexable (evita indexar el carrito/checkout). */
export const metadata: Metadata = {
  title: "Finalizar compra | Aventus Perfumería",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
