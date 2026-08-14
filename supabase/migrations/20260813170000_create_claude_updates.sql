-- =============================================================================
-- Migration: create_claude_updates
-- Mural do Claude: o agente diário escreve aqui os resumos (varreduras de e-mail
-- e outros achados). O app lê e renderiza no feed. ADITIVA.
-- =============================================================================

create table if not exists public.claude_updates (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null default 'varredura_email',  -- varredura_email | alerta | nota
  titulo     text not null,
  resumo     text,
  payload    jsonb not null default '{}'::jsonb,        -- itens estruturados (boletos/NFs etc.)
  created_at timestamptz not null default now()
);

create index if not exists claude_updates_created_at_idx on public.claude_updates (created_at desc);

-- RLS: time autenticado vê e gerencia. Sem 'anon'.
alter table public.claude_updates enable row level security;

drop policy if exists claude_updates_select_authenticated on public.claude_updates;
create policy claude_updates_select_authenticated
  on public.claude_updates for select to authenticated using (true);

drop policy if exists claude_updates_insert_authenticated on public.claude_updates;
create policy claude_updates_insert_authenticated
  on public.claude_updates for insert to authenticated with check (true);

drop policy if exists claude_updates_delete_authenticated on public.claude_updates;
create policy claude_updates_delete_authenticated
  on public.claude_updates for delete to authenticated using (true);
