import type { Metadata } from "next";

/** Ruta privada de sesión: no debe indexarse. */
export const metadata: Metadata = {
  title: "Ingresar | Aventus Perfumería",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
