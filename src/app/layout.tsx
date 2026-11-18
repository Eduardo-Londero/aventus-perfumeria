import type { Metadata } from "next";

import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import CartDrawer from "@/components/cart/CartDrawer";
import ToastContainer from "@/components/ui/ToastContainer";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aventus Perfumería | Perfumes y fragancias",
  description:
    "Perfumes originales y seleccionados para quienes buscan una fragancia que los represente. Las mejores marcas: Dior, Chanel, Creed, Hermès y más.",
  keywords: [
    "perfumes",
    "fragancias",
    "perfumería",
    "Dior",
    "Chanel",
    "Creed",
    "Hermès",
    "perfumes originales",
    "Argentina",
  ],
  openGraph: {
    title: "Aventus Perfumería | Perfumes y fragancias",
    description:
      "Perfumes originales y seleccionados para quienes buscan una fragancia que los represente.",
    type: "website",
    locale: "es_AR",
    siteName: "Aventus Perfumería",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aventus Perfumería | Perfumes y fragancias",
    description:
      "Perfumes originales y seleccionados para quienes buscan una fragancia que los represente.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <Header />
          <CartDrawer />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <WhatsAppButton />
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
