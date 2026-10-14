/**
 * Tipos de CMS - Contenido editable desde el admin
 */

export interface SiteSettings {
  storeName: string;
  tagline: string;
  description: string;
  logo?: string;
  favicon?: string;
  contact: {
    whatsapp: string;
    instagram: string;
    email: string;
    phone: string;
  };
  store: {
    address: string;
    city: string;
    phone: string;
    hours: { days: string; hours: string }[];
    mapsUrl: string;
  };
  social: {
    instagram: string;
    facebook?: string;
    tiktok?: string;
  };
  appearance: {
    primaryColor: string;
    secondaryColor: string;
  };
}

export interface HeroSection {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonLink: string;
  isActive: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonLink: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  order: number;
  type: "promotion" | "discount" | "collection" | "season" | "launch" | "campaign";
}

export interface HomepageSection {
  id: string;
  type: "hero" | "categories" | "featured" | "offers" | "newArrivals" | "banner" | "brands" | "about" | "instagram" | "contact";
  title: string;
  isActive: boolean;
  order: number;
  content?: Record<string, unknown>;
}

export interface AboutPage {
  hero: {
    title: string;
    subtitle: string;
    image: string;
  };
  history: {
    title: string;
    content: string;
    image: string;
  };
  proposal: {
    title: string;
    values: { title: string; description: string; icon: string }[];
  };
  store: {
    title: string;
    image: string;
    address: string;
    hours: { days: string; hours: string }[];
    whatsapp: string;
    instagram: string;
    mapsUrl: string;
  };
}

export interface ContactPage {
  hero: {
    title: string;
    subtitle: string;
    image: string;
  };
  contact: {
    whatsapp: string;
    instagram: string;
    email: string;
    phone: string;
  };
  store: {
    address: string;
    hours: { days: string; hours: string }[];
    mapsUrl: string;
  };
}
