-- ============================================================================
-- Migración 0011 — Perfiles para usuarios creados vía Google OAuth
-- ============================================================================
-- Propósito: el trigger `handle_new_user` (migración 0006) asumía que los
-- metadatos del signup siempre traían `name` + `lastName`. Los usuarios que
-- entran con Google OAuth traen otros campos (`full_name`, `name`, `given_name`,
-- `family_name`, `phone_number`), por lo que el perfil quedaba con
-- full_name NULL. Se generaliza el trigger para soportar ambos casos.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(
    nullif(trim(coalesce(v_meta->>'full_name', '')), ''),
    nullif(trim(coalesce(v_meta->>'name', '') || ' ' || coalesce(v_meta->>'lastName', '')), ''),
    nullif(trim(coalesce(v_meta->>'given_name', '') || ' ' || coalesce(v_meta->>'family_name', '')), ''),
    nullif(trim(coalesce(v_meta->>'name', '')), '')
  );

  v_phone := coalesce(
    nullif(trim(coalesce(v_meta->>'phone', '')), ''),
    nullif(trim(coalesce(v_meta->>'phone_number', '')), '')
  );

  insert into public.profiles (id, role, full_name, phone, created_at, updated_at)
  values (
    new.id,
    'customer',
    v_full_name,
    v_phone,
    now(),
    now()
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone     = coalesce(excluded.phone, public.profiles.phone),
        updated_at = now();

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea public.profiles al registrarse un usuario (email o Google OAuth).';