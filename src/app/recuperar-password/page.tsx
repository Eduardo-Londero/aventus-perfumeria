"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Recuperar contraseña
 * ====================
 * Dos modos:
 *
 *  1. "Pedir enlace" (default): llama a Supabase Auth
 *     (`resetPasswordForEmail`) y muestra la confirmación.
 *
 *  2. "Elegir contraseña nueva": se activa solo cuando el usuario abre el
 *     enlace del email. Supabase envía un token en el fragmento `#...` de la
 *     URL, el cliente lo intercambia por una sesión de recuperación
 *     (`detectSessionInUrl` en supabaseClient) y acá se ofrece el form para
 *     fijar la contraseña nueva vía `auth.updateUser`.
 */
export default function RecuperarPasswordPage() {
  const { requestPasswordReset, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Modo "recuperación activa" (enlace abierto).
  const [isRecovery, setIsRecovery] = useState(false);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = getSupabase();
      // getSession() espera la inicialización del cliente, que es la que
      // procesa el token de recuperación presente en la URL.
      void supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (cancelled) return;
          setIsRecovery(!!session?.user);
          setIsCheckingRecovery(false);
        })
        .catch(() => {
          if (!cancelled) setIsCheckingRecovery(false);
        });
    } catch {
      // Sin claves Supabase en el entorno: solo queda el modo "pedir enlace".
      if (!cancelled) setIsCheckingRecovery(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("El email es requerido");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("El email no es válido");
      return;
    }

    const success = await requestPasswordReset(email);
    if (success) {
      setIsSubmitted(true);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");

    if (newPassword.length < 6) {
      setRecoveryError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError("Las contraseñas no coinciden");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setRecoveryError(
          updateError.message.includes("same")
            ? "La contraseña nueva no puede ser igual a la actual."
            : updateError.message
        );
        return;
      }

      // Cerrar la sesión de recuperación: el usuario entra de nuevo con la
      // contraseña nueva desde /login.
      await supabase.auth.signOut().catch(() => undefined);
      router.push("/login?reset=ok");
    } catch {
      setRecoveryError("No se pudo actualizar la contraseña. Intentá nuevamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------
  // Modo 2: sesión de recuperación activa → elegir contraseña nueva
  // ---------------------------------------------------------------
  if (isCheckingRecovery) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <p className="text-charcoal-600">Verificando enlace...</p>
      </div>
    );
  }

  if (isRecovery) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <span className="font-serif text-3xl font-semibold text-charcoal-900">
                AVENTUS
              </span>
              <span className="font-serif text-3xl font-light text-charcoal-900 ml-1">
                Perfumería
              </span>
            </Link>
          </div>

          <div className="bg-white border border-charcoal-100 rounded-lg p-8">
            <h1 className="font-serif text-2xl text-charcoal-900 mb-2 text-center">
              Elegí tu contraseña nueva
            </h1>
            <p className="text-charcoal-600 text-center mb-8">
              Ingresá tu nueva contraseña para completar la recuperación.
            </p>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-sm text-charcoal-600 mb-1.5">
                  Contraseña nueva
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setRecoveryError("");
                  }}
                  className={`input-aventus ${recoveryError ? "border-red-500" : ""}`}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-charcoal-600 mb-1.5">
                  Repetir contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setRecoveryError("");
                  }}
                  className={`input-aventus ${recoveryError ? "border-red-500" : ""}`}
                  placeholder="Repetí la contraseña"
                />
                {recoveryError && (
                  <p className="text-xs text-red-500 mt-1">{recoveryError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Guardando..." : "GUARDAR CONTRASEÑA"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-charcoal-900 mb-3">
            Email enviado
          </h1>
          <p className="text-charcoal-600 mb-8">
            Si el email <span className="font-medium">{email}</span> está
            registrado, recibirás un enlace para recuperar tu contraseña.
          </p>
          <Link href="/login" className="btn-primary">
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="font-serif text-3xl font-semibold text-charcoal-900">
              AVENTUS
            </span>
            <span className="font-serif text-3xl font-light text-charcoal-900 ml-1">
              Perfumería
            </span>
          </Link>
        </div>

        <div className="bg-white border border-charcoal-100 rounded-lg p-8">
          <h1 className="font-serif text-2xl text-charcoal-900 mb-2 text-center">
            Recuperar contraseña
          </h1>
          <p className="text-charcoal-600 text-center mb-8">
            Ingresá tu email y te enviaremos un enlace para restablecer tu
            contraseña.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-charcoal-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className={`input-aventus ${error ? "border-red-500" : ""}`}
                placeholder="tu@email.com"
              />
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Enviando..." : "ENVIAR ENLACE"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-charcoal-100 text-center">
            <p className="text-sm text-charcoal-600">
              ¿Recordaste tu contraseña?{" "}
              <Link
                href="/login"
                className="text-gold-600 hover:text-gold-700 font-medium"
              >
                Iniciá sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
