-- =============================================================================
-- Migration: create_processos
-- App: Controle de Processos Amitran (separado do CRM, mesmo banco).
-- ADITIVA: cria APENAS a tabela nova `processos`. Não altera nenhuma tabela
-- existente (deals, deal_installments, profiles permanecem intactas).
-- =============================================================================

-- 1 processo por deal (mudança fechada). FK para deals; cascade: se o deal
-- for removido no CRM, o processo correspondente some junto.
create table if not exists public.processos (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null unique references public.deals(id) on delete cascade,
  status     text not null default 'fechadas'
             check (status in ('fechadas','faturamento','acompanhamento','recebido')),
  campos     jsonb not null default '{}'::jsonb,  -- valores dos campos das 4 abas
  obs        jsonb not null default '{}'::jsonb,  -- threads de observação por aba
  log        jsonb not null default '[]'::jsonb,  -- histórico assinado (quem/o quê/quando)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Board filtra por coluna/status.
create index if not exists processos_status_idx on public.processos (status);

-- updated_at automático em cada UPDATE.
create or replace function public.processos_set_updated_at()
returns trigger
language plpgsql
set search_path = ''  -- linter Supabase: search_path fixo; now() resolve via pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists processos_updated_at on public.processos;
create trigger processos_updated_at
  before update on public.processos
  for each row
  execute function public.processos_set_updated_at();

-- =============================================================================
-- RLS PRÓPRIO desta tabela.
-- Regra: TODO usuário autenticado vê e edita TODOS os processos.
-- NÃO usa a regra "vendedor vê só o dele" do CRM. NÃO abre para 'anon'.
-- (Delete direto omitido de propósito: processos só somem via cascade do deal.)
-- =============================================================================
alter table public.processos enable row level security;

drop policy if exists processos_select_authenticated on public.processos;
create policy processos_select_authenticated
  on public.processos
  for select
  to authenticated
  using (true);

drop policy if exists processos_insert_authenticated on public.processos;
create policy processos_insert_authenticated
  on public.processos
  for insert
  to authenticated
  with check (true);

drop policy if exists processos_update_authenticated on public.processos;
create policy processos_update_authenticated
  on public.processos
  for update
  to authenticated
  using (true)
  with check (true);
