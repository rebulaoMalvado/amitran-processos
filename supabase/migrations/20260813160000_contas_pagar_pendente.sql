-- =============================================================================
-- Migration: contas_pagar_pendente
-- Suporte ao fluxo de importação por e-mail: contas extraídas entram como
-- 'pendente' (revisão) antes de virarem 'aberta'. Coluna `origem` rastreia
-- se a conta foi lançada manualmente ou importada do e-mail. ADITIVA.
-- =============================================================================

alter table public.contas_pagar drop constraint contas_pagar_status_check;
alter table public.contas_pagar
  add constraint contas_pagar_status_check
  check (status in ('pendente','aberta','paga'));

alter table public.contas_pagar
  add column if not exists origem text not null default 'manual';
