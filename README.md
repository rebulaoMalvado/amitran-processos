# Controle de Processos Amitran

App interno do time administrativo da Amitran Mudanças para gerir o
pós-fechamento de cada mudança (board de 4 abas). **Separado do CRM**, mas usa o
**mesmo banco Supabase** (`amitran-crm`, ref `dplvfhemomxhwxhuzhmm`) e o mesmo Auth.

## Stack
React + Vite + TypeScript + Tailwind + Supabase. Deploy na Vercel.

## Rodar local
```bash
cp .env.example .env   # já preenchido com URL + publishable key do projeto
npm install
npm run dev
```

## Auth
- Login por e-mail + senha, sessão persistente (localStorage) com auto-refresh.
- **Sem cadastro aberto**: usuários são criados manualmente no painel do Supabase
  (Authentication → Users) e devem ter uma linha em `public.profiles`.

## Banco
Tabelas **existentes** (compartilhadas com o CRM, não recriar): `deals`,
`deal_installments`, `profiles`.

Tabelas **novas** deste app:
- `processos` (1 por deal) — [migration](supabase/migrations/20260813120000_create_processos.sql).
- `contas_pagar` (módulo Financeiro) — [migration](supabase/migrations/20260813140000_create_contas_pagar.sql).
  Abrangente (categorias terceiro/fornecedor/fixa/imposto-veículo/outro), FK opcional
  `deal_id` para margem por mudança, sem recorrência no v1.

### RLS de `processos`
Todo usuário **autenticado** vê e edita **todos** os processos (select/insert/update).
`anon` é bloqueado. Não usa a regra "vendedor vê só o dele" do CRM.

> ⚠️ Como o Auth é compartilhado com o CRM, qualquer usuário do CRM (inclusive
> vendedores) que logar neste app enxerga todos os processos. Se precisar
> restringir ao time administrativo, dá para trocar as policies por
> `role in ('head')` ou introduzir um role 'admin' — decisão em aberto.

## Abas / status do board
`fechadas → faturamento → acompanhamento → recebido`. Campos, obrigatórios
(travas para avançar), threads de observação e log assinado seguem o protótipo
`amitran-processos-v1_1.html` (fonte de verdade do design e das regras).
