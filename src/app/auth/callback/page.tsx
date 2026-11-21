"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase, hasSupabasePublicConfig } from "@/lib/supabaseClient";

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Completando inicio de sesión...");

  useEffect(() => {
    if (!hasSupabasePublicConfig()) {
      router.replace("/login");
      return;
    }

    const supabase = getSupabase();
    const next = params.get("next");
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/mi-cuenta";

    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      router.replace(ok ? safeNext : "/login");
    };

    const code = params.get("code");
    if (code) {
      // Flujo PKCE: intercambiar el código por sesión.
      void supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            setMessage("No se pudo completar el inicio de sesión.");
            finish(false);
            return;
          }
          finish(true);
        });
    } else {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          setMessage("No se pudo completar el inicio de sesión.");
          finish(false);
          return;
        }
        if (data.session) {
          finish(true);
        }
      });
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        data.subscription.unsubscribe();
        finish(true);
      }
    });
    const subscription = data.subscription;

    const timeout = window.setTimeout(() => {
      subscription.unsubscribe();
      finish(false);
    }, 8000);

    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router, params]);

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-charcoal-600 text-sm">{message}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}