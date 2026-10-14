import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aventus Perfumería",
    short_name: "Aventus",
    description: "Perfumes originales y seleccionados para quienes buscan una fragancia que los represente.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFBF7",
    theme_color: "#1A1A1A",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
