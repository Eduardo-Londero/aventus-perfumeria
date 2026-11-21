"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { User, UserRole } from "@/types/auth";
import { getSupabase, hasSupabasePublicConfig } from "@/lib/supabaseClient";
import { useToast } from "./ToastContext";

/** Resultado de un intento de login, con el rol efectivamente otorgado. */
export interface LoginResult {
  ok: boolean;
  role: UserRole | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithGoogle: (nextPath?: string) => Promise<void>;
  register: (data: {
    name: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Sesión del PANEL (solo administradores). El login de clientes vive en
 * Supabase Auth (auth.users) — nunca en el navegador.
 *
 * NOTA DE SEGURIDAD
 * ---------------------------------------------------------------
 * El acceso al panel es POST /api/auth/admin-login, que valida
 * ADMIN_EMAIL/ADMIN_PASSWORD SOLO en el servidor y emite una cookie
 * httpOnly firmada que src/middleware.ts verifica. Acá solo se guarda el
 * objeto de usuario SIN secretos, para que un refresh mantenga la sesión
 * visible (la cookie es la autoridad real).
 * ---------------------------------------------------------------
 */
const ADMIN_SESSION_KEY = "aventus-auth";

/** Cliente Supabase o null si faltan las claves públicas del entorno. */
function supabaseOrNull(): ReturnType<typeof getSupabase> | null {
  try {
    if (!hasSupabasePublicConfig()) return null;
    return getSupabase();
  } catch {
    return null;
  }
}

/** Estado del chequeo server-side de administración durante un login. */
type AdminCheckStatus = "ok" | "unauthorized" | "unavailable" | "error";

async function attemptAdminLogin(
  email: string,
  password: string
): Promise<{ status: AdminCheckStatus; user?: User }> {
  try {
    const res = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = (await res.json()) as { user?: User };
      return { status: "ok", user: data.user };
    }
    if (res.status === 401) return { status: "unauthorized" };
    return { status: "unavailable" };
  } catch {
    return { status: "error" };
  }
}

/** Lee la sesión de admin guardada (si la hay) — solo para restaurar UI. */
function readAdminSession(): User | null {
  try {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as User;
    return parsed && parsed.role === "admin" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Traduce auth.users + public.profiles al tipo `User` de la app.
 * `profiles` es la fuente de verdad (role/full_name/phone); si la fila aún
 * no existe (registro recién confirmado), se usa el metadata del signup.
 */
function mapAuthUser(authUser: AuthUser, profile: {
  role?: string | null;
  full_name?: string | null;
  phone?: string | null;
} | null, address?: {
  street?: string | null;
  city?: string | null;
  postal_code?: string | null;
} | null): User {
  const meta = (authUser.user_metadata ?? {}) as Record<string, string>;
  let fullName = profile?.full_name ?? null;
  if (!fullName) {
    if (meta.name && meta.lastName) {
      fullName = `${meta.name} ${meta.lastName}`.trim();
    } else if (meta.full_name) {
      fullName = meta.full_name.trim();
    } else if (meta.name) {
      fullName = meta.name.trim();
    } else if (meta.given_name || meta.family_name) {
      fullName = [meta.given_name, meta.family_name].filter(Boolean).join(" ").trim();
    }
  }
  const resolvedFullName = (fullName ?? "").trim();
  const [name, ...rest] = resolvedFullName.split(" ");

  return {
    id: authUser.id,
    name: name ?? "",
    lastName: rest.join(" "),
    email: authUser.email ?? "",
    phone: profile?.phone ?? meta.phone ?? meta.phone_number ?? "",
    role: profile?.role === "admin" ? "admin" : "customer",
    address: address?.street ?? undefined,
    city: address?.city ?? undefined,
    postalCode: address?.postal_code ?? undefined,
    createdAt: authUser.created_at,
  };
}

/** Carga perfil + dirección (RLS: el usuario solo ve lo suyo). */
async function loadProfile(authUser: AuthUser): Promise<User> {
  const supabase = supabaseOrNull();
  if (!supabase) return mapAuthUser(authUser, null);

  const [profileRes, addressRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, full_name, phone")
      .eq("id", authUser.id)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("street, city, postal_code")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return mapAuthUser(
    authUser,
    (profileRes.data as { role?: string | null; full_name?: string | null; phone?: string | null } | null) ?? null,
    addressRes.data?.[0] ?? null
  );
}

/** Persiste la dirección del cliente en public.addresses (dueño vía RLS). */
async function persistAddress(userId: string, user: User): Promise<void> {
  const supabase = supabaseOrNull();
  if (!supabase) return;

  const payload = {
    alias: "Principal",
    street: user.address ?? "",
    city: user.city ?? "",
    postal_code: user.postalCode ?? "",
    is_default: true,
  };

  const { data: rows } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const existing = rows?.[0];
  if (existing) {
    await supabase.from("addresses").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("addresses").insert({ ...payload, user_id: userId });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  // Bootstrap: sesión de Supabase Auth (cliente) o sesión de admin (cookie).
  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseOrNull();

    if (!supabase) {
      // Sin claves Supabase solo puede existir la sesión del panel.
      if (!cancelled) {
        setUser(readAdminSession());
        setIsLoading(false);
      }
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        void loadProfile(session.user)
          .then((mapped) => {
            if (!cancelled) setUser(mapped);
          })
          .catch(() => {
            if (!cancelled) setUser(mapAuthUser(session.user, null));
          });
      } else {
        // Sin sesión de cliente: restaurar sesión de panel si existe.
        setUser(readAdminSession());
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setIsLoading(true);

      try {
        // 1) Intento de acceso al panel: se valida SOLO en el servidor.
        const adminAttempt = await attemptAdminLogin(email, password);

        if (adminAttempt.status === "ok" && adminAttempt.user) {
          localStorage.setItem(
            ADMIN_SESSION_KEY,
            JSON.stringify(adminAttempt.user)
          );
          setUser(adminAttempt.user);
          showToast("Bienvenido, administrador", "success");
          setIsLoading(false);
          return { ok: true, role: "admin" };
        }

        // 2) Flujo de clientes: Supabase Auth (auth.users).
        const supabase = supabaseOrNull();
        if (!supabase) {
          showToast(
            "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno. Completá .env.local (ver .env.example).",
            "error"
          );
          setIsLoading(false);
          return { ok: false, role: null };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          if (error?.message?.includes("Email not confirmed")) {
            showToast(
              "Tu email aún no está confirmado. Revisá tu correo para activar la cuenta.",
              "error"
            );
          } else {
            showToast("Email o contraseña incorrectos", "error");
          }
          setIsLoading(false);
          return { ok: false, role: null };
        }

        const mapped = await loadProfile(data.user);
        setUser(mapped);
        showToast(`Bienvenido, ${mapped.name}`, "success");
        setIsLoading(false);
        return { ok: true, role: mapped.role };
      } catch {
        showToast("Error al iniciar sesión", "error");
        setIsLoading(false);
        return { ok: false, role: null };
      }
    },
    [showToast]
  );

  const loginWithGoogle = useCallback(
    async (nextPath?: string): Promise<void> => {
      setIsLoading(true);
      try {
        const supabase = supabaseOrNull();
        if (!supabase) {
          showToast(
            "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno. Completá .env.local (ver .env.example).",
            "error"
          );
          setIsLoading(false);
          return;
        }

        const safeNext =
          nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
            ? nextPath
            : "/mi-cuenta";

        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          safeNext
        )}`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });

        if (error) {
          showToast(error.message || "No se pudo iniciar sesión con Google", "error");
          setIsLoading(false);
        }
        // Si no hay error, el navegador redirige a Google/Supabase y la
        // página se descarga; el estado queda en "cargando" hasta entonces.
      } catch {
        showToast("No se pudo iniciar sesión con Google", "error");
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const register = useCallback(
    async (data: {
      name: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
    }): Promise<boolean> => {
      setIsLoading(true);

      try {
        const supabase = supabaseOrNull();
        if (!supabase) {
          showToast(
            "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno. Completá .env.local (ver .env.example).",
            "error"
          );
          setIsLoading(false);
          return false;
        }

        const { data: result, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            // El trigger `handle_new_user` (migración 0006) crea el profile.
            data: { name: data.name, lastName: data.lastName, phone: data.phone },
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/login`
                : undefined,
          },
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("already registered") || msg.includes("already exists")) {
            showToast("Ya existe una cuenta con este email", "error");
          } else {
            showToast(error.message || "Error al crear la cuenta", "error");
          }
          setIsLoading(false);
          return false;
        }

        if (result.session?.user) {
          // Sin confirmación de email (configurado así en Supabase): entra ya.
          const mapped = await loadProfile(result.session.user);
          setUser(mapped);
          showToast("Cuenta creada exitosamente", "success");
          setIsLoading(false);
          return true;
        }

        // Con confirmación de email activa: aún no hay sesión.
        showToast(
          "Te enviamos un email para confirmar tu cuenta. Revisá tu correo para continuar.",
          "info"
        );
        setIsLoading(false);
        return false;
      } catch {
        showToast("Error al crear la cuenta", "error");
        setIsLoading(false);
        return false;
      }
    },
    [showToast]
  );

  const logout = useCallback(() => {
    // Cerrar también la cookie httpOnly del panel (si la hubiera)
    if (user?.role === "admin") {
      void fetch("/api/auth/admin-logout", { method: "POST" }).catch(() => undefined);
    }
    // Cerrar la sesión de Supabase Auth (no-op si no hay sesión de cliente).
    const supabase = supabaseOrNull();
    if (supabase) {
      void supabase.auth.signOut().catch(() => undefined);
    }
    // Limpiar estado de React
    setUser(null);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    // Limpiar carrito y favoritos del usuario
    localStorage.removeItem("aventus-cart");
    localStorage.removeItem("aventus-favorites");
    // Limpiar cualquier otro estado residual
    sessionStorage.clear();
    showToast("Sesión cerrada", "info");
  }, [user, showToast]);

  const updateProfile = useCallback(
    (data: Partial<User>) => {
      if (!user) return;

      const updatedUser = { ...user, ...data };
      setUser(updatedUser);

      if (user.role === "admin") {
        // El panel no tiene fila en profiles: solo se refresca la sesión local.
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(updatedUser));
        showToast("Perfil actualizado correctamente", "success");
        return;
      }

      const supabase = supabaseOrNull();
      if (!supabase) {
        showToast("Perfil actualizado correctamente", "success");
        return;
      }

      const touchesIdentity =
        "name" in data || "lastName" in data || "phone" in data;
      const touchesAddress =
        "address" in data || "city" in data || "postalCode" in data;

      // Persistencia async (la firma del contexto es síncrona por compatibilidad
      // con la UI): optimista en memoria, error visible si el servidor rechaza.
      void (async () => {
        try {
          if (touchesIdentity) {
            const { error } = await supabase
              .from("profiles")
              .update({
                full_name: `${updatedUser.name} ${updatedUser.lastName}`.trim(),
                phone: updatedUser.phone,
              })
              .eq("id", user.id);
            if (error) throw new Error(error.message);
          }
          if (touchesAddress) {
            await persistAddress(user.id, updatedUser);
          }
          showToast("Perfil actualizado correctamente", "success");
        } catch (err) {
          showToast(
            `No se pudo guardar el perfil: ${err instanceof Error ? err.message : "error desconocido"}`,
            "error"
          );
        }
      })();
    },
    [user, showToast]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      setIsLoading(true);

      try {
        const supabase = supabaseOrNull();
        if (!supabase) {
          showToast("La función no está disponible sin Supabase Auth.", "error");
          setIsLoading(false);
          return false;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const email = session?.user.email;
        if (!email) {
          showToast("Iniciá sesión para cambiar la contraseña.", "error");
          setIsLoading(false);
          return false;
        }

        // Supabase exige login reciente para cambiar la contraseña:
        // se verifica la actual re-autenticando y luego se actualiza.
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyError) {
          showToast("La contraseña actual es incorrecta", "error");
          setIsLoading(false);
          return false;
        }

        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          showToast(error.message || "No se pudo actualizar la contraseña", "error");
          setIsLoading(false);
          return false;
        }

        showToast("Contraseña actualizada correctamente", "success");
        setIsLoading(false);
        return true;
      } catch {
        showToast("Error al cambiar la contraseña", "error");
        setIsLoading(false);
        return false;
      }
    },
    [showToast]
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<boolean> => {
      setIsLoading(true);

      try {
        const supabase = supabaseOrNull();
        if (!supabase) {
          showToast("La función no está disponible sin Supabase Auth.", "error");
          setIsLoading(false);
          return false;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/recuperar-password`
              : undefined,
        });

        if (error) {
          showToast(
            "No se pudo enviar el email de recuperación. Intentá nuevamente.",
            "error"
          );
          setIsLoading(false);
          return false;
        }

        showToast(
          "Si el email existe, recibirás un enlace de recuperación",
          "success"
        );
        setIsLoading(false);
        return true;
      } catch {
        showToast("No se pudo enviar el email de recuperación.", "error");
        setIsLoading(false);
        return false;
      }
    },
    [showToast]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isLoading,
        login,
        loginWithGoogle,
        register,
        logout,
        updateProfile,
        changePassword,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
