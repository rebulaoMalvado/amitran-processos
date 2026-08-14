-- =============================================================================
-- Migration: create_contas_pagar
-- Módulo Financeiro > Contas a pagar. ADITIVA: cria só a tabela nova.
-- Uma tabela abrangente (categoriza com o tempo). FK opcional pro deal, para
-- permitir margem por mudança (valor do deal x custos de terceiro).
-- Sem recorrência no v1 (cada conta é um lançamento avulso).
-- =============================================================================

create table if not exists public.contas_pagar (
  id           uuid primary key default gen_random_uuid(),
  descricao    text not null,
  categoria    text not null default 'outro'
               check (categoria in ('terceiro','fornecedor','fixa','imposto_veiculo','outro')),
  favorecido   text,                       -- quem recebe (fornecedor/parceiro/motorista)
  deal_id      uuid references public.deals(id) on delete set null,  -- opcional: liga à mudança
  valor        numeric not null default 0,
  vencimento   date not null,
  status       text not null default 'aberta' check (status in ('aberta','paga')),
  forma_pagamento text,                     -- Boleto | Pix | ... (livre)
  pago_em      date,
  valor_pago   numeric,
  obs          text,
  log          jsonb not null default '[]'::jsonb,  -- histórico assinado (quem/o quê/quando)
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists contas_pagar_status_idx     on public.contas_pagar (status);
create index if not exists contas_pagar_vencimento_idx on public.contas_pagar (vencimento);
create index if not exists contas_pagar_deal_id_idx    on public.contas_pagar (deal_id);

create or replace function public.contas_pagar_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contas_pagar_updated_at on public.contas_pagar;
create trigger contas_pagar_updated_at
  before update on public.contas_pagar
  for each row
  execute function public.contas_pagar_set_updated_at();

-- =============================================================================
-- RLS: mesma regra de `processos` — todo usuário autenticado vê e edita tudo.
-- Aqui INCLUI delete (lançamento errado precisa poder ser removido). Sem 'anon'.
-- =============================================================================
alter table public.contas_pagar enable row level security;

drop policy if exists contas_pagar_select_authenticated on public.contas_pagar;
create policy contas_pagar_select_authenticated
  on public.contas_pagar for select to authenticated using (true);

drop policy if exists contas_pagar_insert_authenticated on public.contas_pagar;
create policy contas_pagar_insert_authenticated
  on public.contas_pagar for insert to authenticated with check (true);

drop policy if exists contas_pagar_update_authenticated on public.contas_pagar;
create policy contas_pagar_update_authenticated
  on public.contas_pagar for update to authenticated using (true) with check (true);

drop policy if exists contas_pagar_delete_authenticated on public.contas_pagar;
create policy contas_pagar_delete_authenticated
  on public.contas_pagar for delete to authenticated using (true);
