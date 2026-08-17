-- =============================================================================
-- Migration: create_extrato
-- Importação de extrato bancário (OFX) para conferência e relatório mensal.
-- ADITIVA. Dedup por (acctid, fitid) — reimportar o mesmo OFX não duplica.
-- =============================================================================

create table if not exists public.extrato_transacoes (
  id           uuid primary key default gen_random_uuid(),
  fitid        text not null,                 -- id único da transação no OFX
  acctid       text not null default '',      -- conta bancária (do OFX)
  bankid       text,
  data         date not null,                 -- DTPOSTED
  valor        numeric not null,              -- assinado: negativo=saída, positivo=entrada
  tipo         text,                          -- TRNTYPE (DEBIT/CREDIT/...)
  descricao    text,                          -- MEMO/NAME
  conferido    boolean not null default false,
  conferido_by uuid references auth.users(id) on delete set null,
  conferido_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (acctid, fitid)
);

create index if not exists extrato_data_idx on public.extrato_transacoes (data desc);

-- RLS: time autenticado vê e edita tudo. Sem 'anon'.
alter table public.extrato_transacoes enable row level security;

drop policy if exists extrato_all_authenticated on public.extrato_transacoes;
create policy extrato_all_authenticated on public.extrato_transacoes
  for all to authenticated using (true) with check (true);
