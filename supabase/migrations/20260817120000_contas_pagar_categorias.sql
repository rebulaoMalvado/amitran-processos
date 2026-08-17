-- =============================================================================
-- Migration: contas_pagar_categorias
-- Novo conjunto de categorias de Contas a pagar (pedido do time).
-- Remapeia as contas existentes antes de trocar o check. Só a tabela própria.
-- =============================================================================

-- 1) Remove o check antigo ANTES de remapear (senão os valores novos violam o antigo).
alter table public.contas_pagar drop constraint contas_pagar_categoria_check;

-- 2) Remapeia dados existentes p/ o novo conjunto (melhor esforço pelos conhecidos).
update public.contas_pagar set categoria = case
  when descricao ilike 'Aluguel%'                               then 'aluguel'
  when descricao ilike 'Sem Parar%'                             then 'pedagio'
  when descricao ilike 'Claro%'                                 then 'internet_telefone'
  when descricao ilike 'Rastreamento%'                          then 'diversos'
  when favorecido ilike '%PASI%' or favorecido ilike '%Porto Seguro%' then 'seguros'
  when categoria = 'terceiro'                                   then 'terceirizacao'
  when categoria = 'imposto_veiculo'                            then 'imposto'
  else 'diversos'
end;

-- 3) Adiciona o novo check.
alter table public.contas_pagar
  add constraint contas_pagar_categoria_check
  check (categoria in (
    'embalagem','manutencao','imposto','terceirizacao','aluguel','folha',
    'chapas','retirada','internet_telefone','seguros','pedagio','diversos'
  ));

-- 4) Novo default.
alter table public.contas_pagar alter column categoria set default 'diversos';
