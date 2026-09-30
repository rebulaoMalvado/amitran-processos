-- =============================================================================
-- Migration: gm_pagamentos_isento
-- Adiciona o estado ISENTO ao controle anual de pagamentos do Guarda-móveis.
-- ADITIVA: só acrescenta uma coluna com default. Não toca em nada existente.
-- =============================================================================
alter table public.gm_pagamentos
  add column if not exists isento boolean not null default false;
