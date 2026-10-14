"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useToast } from "./ToastContext";

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  clearFavorites: () => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
  undefined
);

const STORAGE_KEY = "aventus-favorites";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { showToast } = useToast();

  // Cargar favoritos desde localStorage al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      // Si hay error al parsear, iniciar con lista vacía
    }
    setIsLoaded(true);
  }, []);

  // Guardar favoritos en localStorage cuando cambian
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }
  }, [favorites, isLoaded]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      // Se decide la acción con el estado actual ANTES de actualizar.
      const isRemoving = favorites.includes(productId);

      // El actualizador permanece puro: solo calcula la nueva lista.
      // React lo ejecuta durante el render, por lo que showToast (que hace
      // setState en ToastProvider) no puede invocarse desde aquí.
      setFavorites((prev) =>
        prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId]
      );

      // Una única notificación por alteración, fuera del render.
      showToast(
        isRemoving ? "Eliminado de favoritos" : "Agregado a favoritos",
        isRemoving ? "info" : "success"
      );
    },
    [favorites, showToast]
  );

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    showToast("Favoritos vaciados", "info");
  }, [showToast]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        toggleFavorite,
        isFavorite,
        clearFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
