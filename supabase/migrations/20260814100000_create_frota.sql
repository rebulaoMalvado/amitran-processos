-- =============================================================================
-- Migration: create_frota
-- Módulo Manutenção: caminhões da empresa + manutenções por caminhão.
-- ADITIVA: cria só tabelas novas. Não toca em nada existente.
-- =============================================================================

create table if not exists public.caminhoes (
  id         uuid primary key default gen_random_uuid(),
  placa      text not null,
  modelo     text,                 -- ex: "Mercedes Accelo 1016"
  apelido    text,                 -- ex: "Baú 01"
  ano        integer,
  ativo      boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manutencoes (
  id          uuid primary key default gen_random_uuid(),
  caminhao_id uuid not null references public.caminhoes(id) on delete cascade,
  descricao   text not null,       -- qual manutenção foi feita
  data        date not null,       -- dia da manutenção
  valor       numeric not null default 0,
  obs         text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists manutencoes_caminhao_idx on public.manutencoes (caminhao_id);
create index if not exists manutencoes_data_idx on public.manutencoes (data desc);

-- updated_at automático (função dedicada da frota, search_path fixo).
create or replace function public.frota_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists caminhoes_updated_at on public.caminhoes;
create trigger caminhoes_updated_at before update on public.caminhoes
  for each row execute function public.frota_set_updated_at();

drop trigger if exists manutencoes_updated_at on public.manutencoes;
create trigger manutencoes_updated_at before update on public.manutencoes
  for each row execute function public.frota_set_updated_at();

-- =============================================================================
-- RLS: time autenticado vê e edita tudo (inclui delete). Sem 'anon'.
-- =============================================================================
alter table public.caminhoes enable row level security;
alter table public.manutencoes enable row level security;

drop policy if exists caminhoes_all_authenticated on public.caminhoes;
create policy caminhoes_all_authenticated on public.caminhoes
  for all to authenticated using (true) with check (true);

drop policy if exists manutencoes_all_authenticated on public.manutencoes;
create policy manutencoes_all_authenticated on public.manutencoes
  for all to authenticated using (true) with check (true);
