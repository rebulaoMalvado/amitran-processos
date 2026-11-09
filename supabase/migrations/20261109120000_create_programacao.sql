-- =============================================================================
-- Migration: create_programacao (módulo Programação / logística)
-- 1 linha por atividade-dia: "dia 07 embalagem do João", "dia 09 viagem a SP"…
-- Responde: onde está cada caminhão (e cada pessoa da equipe) em cada dia, fazendo o quê.
-- ADITIVA: cria só a tabela nova `programacao`. Não toca em deals/profiles/processos
-- nem em qualquer objeto existente (só referencia deals e caminhoes via FK).
--
-- ⚠️ PRIVACIDADE: o repositório é PÚBLICO. Esta migration cria só a estrutura; os
-- dados (clientes, equipe) vivem apenas no banco. `equipe` guarda ids de
-- public.colaboradores (nunca nomes).
-- =============================================================================

create table if not exists public.programacao (
  id          uuid primary key default gen_random_uuid(),
  data        date not null,
  tipo        text not null default 'outro'
              check (tipo in ('embalagem','coleta','viagem','entrega','retorno','manutencao','outro')),
  status      text not null default 'previsto'
              check (status in ('previsto','feito','cancelado')),
  -- Mudança/cliente. `deal_id` liga ao CRM (opcional); `cliente` é o texto exibido
  -- (preenchido a partir do deal, ou digitado quando a mudança ainda não está no CRM).
  deal_id     uuid references public.deals(id) on delete set null,
  cliente     text,
  -- Quem executa: caminhão da frota, terceiro (parceiro) ou nenhum (ex.: embalagem só com equipe).
  caminhao_id uuid references public.caminhoes(id) on delete set null,
  terceiro    boolean not null default false,
  local       text,                                  -- ex.: "BH → São Paulo"
  equipe      uuid[] not null default '{}',          -- ids de public.colaboradores
  obs         text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- terceiro não usa caminhão da frota
  check (not (terceiro and caminhao_id is not null))
);

create index if not exists programacao_data_idx     on public.programacao (data);
create index if not exists programacao_caminhao_idx on public.programacao (caminhao_id);
create index if not exists programacao_deal_idx     on public.programacao (deal_id);

-- updated_at automático (função dedicada, search_path fixo).
create or replace function public.programacao_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists programacao_updated_at on public.programacao;
create trigger programacao_updated_at before update on public.programacao
  for each row execute function public.programacao_set_updated_at();

-- =============================================================================
-- RLS: time administrativo autenticado vê e edita tudo. 'anon' bloqueado.
-- =============================================================================
alter table public.programacao enable row level security;

drop policy if exists programacao_all_authenticated on public.programacao;
create policy programacao_all_authenticated on public.programacao
  for all to authenticated using (true) with check (true);
