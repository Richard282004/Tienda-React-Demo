-- Página principal (2026-09-24): la configuración de la portada vive en
-- site_content con key = 'home'. Las políticas existentes dejan escribir
-- site_content a admin y dev (is_staff); estas políticas RESTRICTIVAS se
-- suman a ellas y exigen is_admin() solo para el registro 'home'. El resto de
-- los textos ('store') sigue igual para el rol dev. Lectura pública sin cambios.
begin;

drop policy if exists "content_home_admin_only_insert" on public.site_content;
create policy "content_home_admin_only_insert" on public.site_content
as restrictive for insert to authenticated
with check (key <> 'home' or public.is_admin());

drop policy if exists "content_home_admin_only_update" on public.site_content;
create policy "content_home_admin_only_update" on public.site_content
as restrictive for update to authenticated
using (key <> 'home' or public.is_admin())
with check (key <> 'home' or public.is_admin());

drop policy if exists "content_home_admin_only_delete" on public.site_content;
create policy "content_home_admin_only_delete" on public.site_content
as restrictive for delete to authenticated
using (key <> 'home' or public.is_admin());

commit;
