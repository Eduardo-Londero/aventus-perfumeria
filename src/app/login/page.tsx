"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const { login, loginWithGoogle, isLoading } = useAuth();
  const params = useSearchParams();
  const nextPath = params.get("next");
  const reason = params.get("reason");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Por favor ingresá un email válido";
    }

    if (!form.password) {
      newErrors.password = "La contraseña es requerida";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const result = await login(form.email, form.password);

    if (result.ok) {
      // Redirigir según el rol efectivamente otorgado por el servidor
      if (result.role === "admin") {
        router.push(nextPath && nextPath.startsWith("/admin") ? nextPath : "/admin");
      } else {
        // `?next=` solo acepta rutas INTERNAS del sitio (empieza con una
        // sola barra, sin `//`): permite volver al checkout u otra página
        // sin abrir una redirección a otro dominio.
        const safeNext =
          nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
            ? nextPath
            : null;
        router.push(safeNext ?? "/mi-cuenta");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleGoogleLogin = () => {
    void loginWithGoogle(nextPath ?? undefined);
  };

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
            Ingresá a tu cuenta
          </h1>
          <p className="text-charcoal-600 text-center mb-8">
            Accedé a tus pedidos y favoritos
          </p>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-charcoal-200 rounded-lg text-sm font-medium text-charcoal-700 hover:bg-cream-50 transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-charcoal-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-charcoal-500">o</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-charcoal-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={`input-aventus ${errors.email ? "border-red-500" : ""}`}
                placeholder="tu@email.com"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-charcoal-600 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className={`input-aventus pr-10 ${
                    errors.password ? "border-red-500" : ""
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 border border-charcoal-300 rounded accent-gold-600" />
                <span className="text-sm text-charcoal-600">Recordarme</span>
              </label>
              <Link href="/recuperar-password" className="text-sm text-gold-600 hover:text-gold-700">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Ingresando..." : "INGRESAR"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-charcoal-100 text-center">
            <p className="text-sm text-charcoal-600">
              ¿Todavía no tenés una cuenta?{" "}
              <Link href="/registro" className="text-gold-600 hover:text-gold-700 font-medium">
                Crear cuenta
              </Link>
            </p>
          </div>
        </div>

        {/* Aviso cuando el middleware redirigió desde /admin */}
        {reason && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              {reason === "session_expired"
                ? "Tu sesión de administración expiró. Ingresá nuevamente."
                : "Ingresá con tu usuario de administración para continuar al panel."}
            </p>
          </div>
        )}

        {/* Aviso tras recuperar la contraseña desde /recuperar-password */}
        {params.get("reset") === "ok" && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-800">
              Contraseña actualizada. Ingresá con la nueva contraseña.
            </p>
          </div>
        )}

        {/* Aviso de configuración (solo en desarrollo local) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-4 bg-cream-100 border border-charcoal-100 rounded-lg">
            <p className="text-xs text-charcoal-600">
              El acceso al panel <strong>/admin</strong> requiere definir{" "}
              <code>ADMIN_EMAIL</code> y <code>ADMIN_PASSWORD</code> en{" "}
              <code>.env.local</code>. Las credenciales se validan únicamente en
              el servidor; no se incluyen en el código de la web.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
