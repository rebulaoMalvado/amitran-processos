# Deploy na Vercel

App Vite + React (SPA). A Vercel detecta o preset **Vite** automaticamente:
build `npm run build`, saída `dist`. Nenhum `vercel.json` é necessário.

## Variáveis de ambiente (obrigatórias)

Configure as duas na Vercel (a `ANON_KEY` é a chave **publishable**, segura para
o navegador — o acesso é protegido por RLS no banco):

```
VITE_SUPABASE_URL=https://dplvfhemomxhwxhuzhmm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_kVC2nlMq-COqwd8YgI3M9w_N8XoJUiX
```

## Caminho A — GitHub + Vercel (recomendado, deploy automático a cada push)

```bash
# 1) crie um repo vazio no GitHub (ex: amitran-processos) e conecte:
git remote add origin https://github.com/SEU_USUARIO/amitran-processos.git
git push -u origin main
```

Depois, em vercel.com:
1. **Add New… → Project → Import** o repositório.
2. Framework: **Vite** (autodetectado). Build/Output: padrão.
3. **Environment Variables**: adicione as duas acima (Production + Preview).
4. **Deploy**. A cada `git push`, a Vercel republica sozinha.

## Caminho B — Vercel CLI (deploy direto, sem GitHub)

```bash
npm i -g vercel
vercel login
vercel                 # primeiro deploy (responda as perguntas; framework = Vite)
vercel env add VITE_SUPABASE_URL         # cole a URL
vercel env add VITE_SUPABASE_ANON_KEY    # cole a chave publishable
vercel --prod          # publica em produção
```

## Depois do deploy

- **Usuários**: crie no painel do Supabase (Authentication → Users). Não há
  cadastro aberto no app. Cada usuário precisa também de uma linha em
  `public.profiles` (id = id do auth user) para nome/role aparecerem.
- **Visibilidade**: quem for `head` no `profiles` enxerga todos os deals/parcelas
  do CRM; `vendedor` só os próprios (regra do CRM). O time administrativo/financeiro
  deve ser `head`.
- Auth por e-mail+senha não exige configurar Redirect URLs no Supabase.
