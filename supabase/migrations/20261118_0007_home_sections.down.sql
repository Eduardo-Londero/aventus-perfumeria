-- Reversión de 0007 — home_sections (destruye el CMS del home)
-- Ejecutar en orden inverso respecto de las demás migraciones.
drop table if exists public.home_sections cascade;
