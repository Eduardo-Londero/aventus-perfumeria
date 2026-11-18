import type { Metadata } from "next";

/** Zona privada del cliente: datos personales, no indexable. */
export const metadata: Metadata = {
  title: "Mi cuenta | Aventus Perfumería",
  robots: { index: false, follow: false },
};

export default function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
