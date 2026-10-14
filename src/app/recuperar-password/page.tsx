"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function RecuperarPasswordPage() {
  const { requestPasswordReset, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

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
