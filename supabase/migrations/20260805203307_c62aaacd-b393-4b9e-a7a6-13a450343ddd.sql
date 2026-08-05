create table if not exists public.permissoes_usuario (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid references public.profiles(id) on delete cascade not null,
    area text not null,
    item_menu text not null,
    criado_em timestamptz default now(),
    unique (usuario_id, area, item_menu)
);

grant select, insert, update, delete on public.permissoes_usuario to authenticated;
grant all on public.permissoes_usuario to service_role;

alter table public.permissoes_usuario enable row level security;

-- We'll use a direct role check in the policy since has_role is failing or needs to be defined
create policy "Admins can do everything on permissoes_usuario"
on public.permissoes_usuario
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Users can view their own permissions"
on public.permissoes_usuario
for select
to authenticated
using (usuario_id = auth.uid());
