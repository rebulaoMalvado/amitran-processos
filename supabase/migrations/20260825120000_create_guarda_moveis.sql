-- =============================================================================
-- Migration: create_guarda_moveis (módulo GM)
-- Guarda-móveis: boxes físicos (1..57), locações por cliente e pagamentos mensais.
-- ADITIVA: cria só tabelas novas com prefixo gm_. Não toca em deals/profiles/
-- processos/contas_pagar nem em qualquer objeto existente.
--
-- ⚠️ PRIVACIDADE: o repositório é PÚBLICO. O seed de LOCAÇÕES (nomes reais de
-- clientes) foi aplicado DIRETO no banco via SQL, NÃO fica versionado aqui —
-- mesma política dos colaboradores. Este arquivo cria só a estrutura + os boxes.
-- =============================================================================

-- --------------------------------------------------------------------------
-- gm_boxes — os slots físicos do galpão. `numero` é a chave (1..57 hoje).
-- ativo=false => box existe na planta mas não é locável (ex.: 57, uso interno).
-- --------------------------------------------------------------------------
create table if not exists public.gm_boxes (
  numero     integer primary key check (numero > 0),
  ativo      boolean not null default true,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- gm_locacoes — 1 linha por cliente-no-box.
-- Box com 2 clientes = 2 linhas. Cliente em vários boxes = várias linhas.
-- valor_mensal/dia_vencimento/data_inicio ficam NULL até o financeiro preencher.
-- --------------------------------------------------------------------------
create table if not exists public.gm_locacoes (
  id             uuid primary key default gen_random_uuid(),
  box_numero     integer not null references public.gm_boxes(numero) on delete restrict,
  cliente_nome   text not null,
  volume_m3      numeric,
  valor_mensal   numeric check (valor_mensal is null or valor_mensal >= 0),
  dia_vencimento integer check (dia_vencimento is null or dia_vencimento between 1 and 31),
  data_inicio    date,
  data_fim       date,                  -- encerramento da locação
  ativo          boolean not null default true,
  obs            text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

create index if not exists gm_locacoes_box_idx on public.gm_locacoes (box_numero);
create index if not exists gm_locacoes_ativo_idx on public.gm_locacoes (ativo) where ativo;

-- --------------------------------------------------------------------------
-- gm_pagamentos — 1 linha por locação × mês de referência (1º dia do mês).
-- --------------------------------------------------------------------------
create table if not exists public.gm_pagamentos (
  id             uuid primary key default gen_random_uuid(),
  locacao_id     uuid not null references public.gm_locacoes(id) on delete cascade,
  mes_referencia date not null check (extract(day from mes_referencia) = 1),
  valor          numeric not null default 0,
  pago           boolean not null default false,
  data_pagamento date,
  obs            text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (locacao_id, mes_referencia)
);

create index if not exists gm_pagamentos_mes_idx on public.gm_pagamentos (mes_referencia desc);

-- updated_at automático (função dedicada do GM, search_path fixo).
create or replace function public.gm_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gm_boxes_updated_at on public.gm_boxes;
create trigger gm_boxes_updated_at before update on public.gm_boxes
  for each row execute function public.gm_set_updated_at();

drop trigger if exists gm_locacoes_updated_at on public.gm_locacoes;
create trigger gm_locacoes_updated_at before update on public.gm_locacoes
  for each row execute function public.gm_set_updated_at();

drop trigger if exists gm_pagamentos_updated_at on public.gm_pagamentos;
create trigger gm_pagamentos_updated_at before update on public.gm_pagamentos
  for each row execute function public.gm_set_updated_at();

-- =============================================================================
-- RLS: time administrativo autenticado vê e edita tudo. 'anon' bloqueado.
-- =============================================================================
alter table public.gm_boxes     enable row level security;
alter table public.gm_locacoes  enable row level security;
alter table public.gm_pagamentos enable row level security;

drop policy if exists gm_boxes_all_authenticated on public.gm_boxes;
create policy gm_boxes_all_authenticated on public.gm_boxes
  for all to authenticated using (true) with check (true);

drop policy if exists gm_locacoes_all_authenticated on public.gm_locacoes;
create policy gm_locacoes_all_authenticated on public.gm_locacoes
  for all to authenticated using (true) with check (true);

drop policy if exists gm_pagamentos_all_authenticated on public.gm_pagamentos;
create policy gm_pagamentos_all_authenticated on public.gm_pagamentos
  for all to authenticated using (true) with check (true);

-- =============================================================================
-- SEED estrutural — boxes 1..57. (As LOCAÇÕES com nomes de clientes foram
-- aplicadas direto no banco, fora do repo público — ver aviso no topo.)
-- =============================================================================
insert into public.gm_boxes (numero)
select generate_series(1, 57)
on conflict (numero) do nothing;

-- Box 57 = uso interno (armários de documentos da Amitran), não é locável.
update public.gm_boxes
   set ativo = false,
       observacao = 'Uso interno — armários de documentos da Amitran.'
 where numero = 57;

update public.gm_boxes set observacao = '1 geladeira deste cliente está guardada no box 48.' where numero = 45;
update public.gm_boxes set observacao = 'Guarda 1 geladeira do cliente do box 45.' where numero = 48;
update public.gm_boxes set observacao = 'Planta do cliente guardada no escritório.' where numero = 56;
