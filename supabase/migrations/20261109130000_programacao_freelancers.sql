-- =============================================================================
-- Migration: programacao_freelancers
-- Chapa (ajudante freelancer) por mudança: só o NOME, digitado na hora — não são
-- colaboradores cadastrados. 1 array de nomes por atividade-dia.
-- ADITIVA: só adiciona uma coluna com default em `programacao`.
-- ⚠️ Repo público: aqui só a estrutura; os nomes ficam apenas no banco.
-- =============================================================================
alter table public.programacao
  add column if not exists freelancers text[] not null default '{}';
