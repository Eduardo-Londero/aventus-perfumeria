import type { Metadata } from "next";

/** Recuperación de contraseña: no debe indexarse. */
export const metadata: Metadata = {
  title: "Recuperar contraseña | Aventus Perfumería",
  robots: { index: false, follow: false },
};

export default function RecuperarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
