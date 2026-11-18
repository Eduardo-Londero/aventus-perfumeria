import type { Metadata } from "next";

/** Alta de cuenta: no debe indexarse. */
export const metadata: Metadata = {
  title: "Crear cuenta | Aventus Perfumería",
  robots: { index: false, follow: false },
};

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
