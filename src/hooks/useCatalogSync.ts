"use client";

/**
 * useCatalogSync — sincronización de las pantallas de catálogo (Fase C-2)
 * ======================================================================
 * Un solo hook reemplaza a los tres efectos que las páginas admin tenían que
 * combinar a mano:
 *
 *   1. lectura inicial  → `refresh()` al montar (igual que siempre);
 *   2. backend remoto   → `onBackendReady(refresh)`: en supabase el catálogo
 *      llega por hidratación async y hay que releer cuando llega;
 *   3. fallo de escritura → si el servidor rechaza una operación, db.ts ya
 *      revirtió la fila en memoria: aquí se vuelve a leer y se avisa con toast
 *      el mensaje del servidor.
 *
 * Con el backend por defecto (localStorage) el punto 2 es no-op y el 3 nunca
 * ocurre: el comportamiento es idéntico al del efecto que reemplaza.
 *
 * `refresh` se guarda en un ref para poder pasar una flecha inline sin volver
 * a suscribir el efecto en cada render (y sin loops de render).
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/context/ToastContext";
import { subscribeWriteFailure } from "@/lib/dataSync";
import { onBackendReady } from "@/lib/db";

export function useCatalogSync(refresh: () => void): void {
  const { showToast } = useToast();
  const refreshRef = useRef(refresh);
  const notifyRef = useRef(showToast);

  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    notifyRef.current = showToast;
  });

  useEffect(() => {
    const run = () => refreshRef.current();

    run();
    const offReady = onBackendReady(run);
    const offFailure = subscribeWriteFailure((failure) => {
      refreshRef.current();
      notifyRef.current(failure.message, "error");
    });

    return () => {
      offReady();
      offFailure();
    };
  }, []);
}
