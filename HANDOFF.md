# HANDOFF — Controle de Processos Amitran

Documento de passagem de bastão. Estado do projeto, decisões, regras e próximos
passos. Leia junto com [README.md](README.md) (setup) e [DEPLOY.md](DEPLOY.md).

> ⚠️ **O repositório é PÚBLICO.** Nunca commitar segredos ou dados de colaborador
> (nomes/salários). Só a chave **publishable** do Supabase e a URL ficam no repo
> (são públicas por natureza; RLS protege os dados). A chave `service_role` e os
> dados de folha ficam **só no banco**.

---

## 1. O que é
App interno do time administrativo da **Amitran Mudanças** para gerir o
pós-fechamento das mudanças + financeiro + frota + departamento pessoal.
**Separado do CRM**, mas usa o **mesmo banco Supabase e o mesmo Auth**.

- **Stack:** React + Vite + TypeScript + Tailwind + Supabase.
- **Deploy:** Vercel (produção em `https://amitran-processos.vercel.app`).
- **Repo:** `github.com/rebulaoMalvado/amitran-processos` (público) → push na `main` **republica sozinho** na Vercel.

## 2. Infra & gotchas (importantes)
- **Supabase:** projeto `amitran-crm`, ref **`dplvfhemomxhwxhuzhmm`**, org `jcieqkdrhzshmckfzzod`. Plano **Free** → **sem branching** (migrations aplicadas direto em produção, com aprovação; sempre aditivas).
- **Auth compartilhado com o CRM.** `public.profiles` (roles `vendedor`/`head`). RLS de `deals`/`deal_installments` é **`dono OU is_head()`** → só quem é **`head`** vê tudo. O time admin/financeiro é `head` (Lucas, Roberta/financeiro@maxtran).
- **Vercel:** o plano grátis (Hobby) é não-comercial → deploy de repo **privado** era bloqueado ("Blocked"/pedia Pro). **Solução: repo público** → passou a publicar de graça. Deploy pela CLI trava no sandbox deste chat (upload); **use `git push`** (build roda no servidor da Vercel). `vercel login` já foi feito na máquina.
- **Env vars (Vercel + `.env` local):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable).
- Ferramentas locais: `gh` logado (`rebulaoMalvado`); **sem** docker/psql; Vercel via `npx vercel`.

## 3. Tabelas criadas (migrations em `supabase/migrations/`)
Todas com RLS `authenticated` (sem `anon`). Nada nas tabelas do CRM foi alterado.
- **`processos`** — 1 por deal fechado (board 4 abas). `campos/obs/log` jsonb.
- **`contas_pagar`** — status `pendente|aberta|paga`, `origem` (manual/email), FK opcional `deal_id`, categorias (14: embalagem, manutenção, combustível, imposto, terceirização, aluguel, folha, chapas, retirada, internet_telefone, seguros, pedágio, marketing, diversos).
- **`claude_updates`** — feed do "Mural da Vic" (varreduras de e-mail etc.).
- **`caminhoes`** + **`manutencoes`** — módulo Manutenção (garantia 90 dias auto).
- **`extrato_transacoes`** — extrato OFX (dedup por `acctid,fitid`), FK `conta_id` (conciliação).
- **`folha_pagamento`** — `mes` único + `dados` jsonb (colaboradores × dias × sigla + `bege`).
- **`colaboradores`** — cadastro (salário, função, plano saúde, alimentação, VT, apelido p/ casar com a folha de ponto). **12 colaboradores já cadastrados no banco** (do holerite de jul/26).

## 4. Módulos (todos no ar)
Sidebar: **Assistente** (Novidades da Vic) · **Operação** (Processos) · **Frota** (Manutenção) · **Departamento Pessoal** (Folha de Pagamento, Colaboradores) · **Financeiro** (Contas a pagar, Vencimentos, Extrato). Login fixo no rodapé.

- **Processos** (`ProcessosView`/`ProcessDrawer`): board 4 abas (fechadas→faturamento→acompanhamento→recebido), materializa deals fechados, campos/travas/threads/log assinado. Drawer só da etapa atual + "ver etapas anteriores" + botão **Voltar** (regress). Faturamento tem campos condicionais (nº NF/CTE/DANFE) e "Enviado para Faturamento". Ordenação configurável.
  - ⚠️ Bug corrigido: persistência era intermitente (patch calculado dentro do updater do setState); agora usa `itemsRef`.
- **Contas a pagar** (`ContasView`): lista + calendário, prazos 5º dia útil/dia 20, resumo recolhível, pendentes (import e-mail) com "Confirmar", filtros, categorias.
- **Vencimentos** (`VencimentosView`): recebíveis do CRM (`deal_installments`), "na praça pra receber", prazos, previsão por mês. Só leitura.
- **Extrato** (`ExtratoView`): importa **OFX** (parse no navegador, `lib/ofx.ts`), relatório mensal (entradas/saídas/saldo), conferência, e **conciliação automática** com Contas a pagar (`lib/match.ts`: valor exato + data próxima + nome fuzzy — luis/luiz, acentos). Conciliar dá baixa; desfazer reabre.
- **Novidades da Vic** (`MuralView`): "Vic" = filhotinha do usuário (homenagem — todo "Claude" visível virou "Vic"). Alertas (parados/vencidas/atrasados), atividade assinada (logs), varreduras de e-mail com calendário recolhível.
- **Manutenção** (`ManutencaoView`): caminhões + manutenções (descrição/data/valor), garantia 90 dias auto.
- **Colaboradores** (`ColaboradoresView`): CRUD do cadastro (salário/função/descontos fixos).
- **Folha de Pagamento** (`FolhaView`) — ver seção 6.

## 5. Vic — varredura de e-mail (Contas a pagar)
- Conta conectada: **financeiro@maxtran.com.br** (Gmail MCP). Chegam muitos boletos/NFs.
- **Limitação:** o conector **não baixa anexos** → valor do boleto (que costuma estar no PDF) nem sempre dá pra extrair. Escolha do usuário: **triagem por texto**.
- **Fluxo por varredura:** buscar boletos/NFs **sem** o rótulo `lancado-amitran`; extrair favorecido/vencimento/valor (quando no texto); criar em `contas_pagar` como `pendente` `origem='email'` (só se tiver vencimento — coluna NOT NULL); os sem vencimento/valor → sinalizar no card do Mural (`claude_updates`); **rotular** os threads processados com `lancado-amitran` (id `Label_2`) p/ dedup.
- **Dedup extra:** alguns fornecedores (ex.: Tá Rastreado) reenviam a mesma fatura em thread novo → conferir favorecido+vencimento antes de criar.
- **Automação diária (07:00) — BLOQUEADA por ora:** routines (nuvem) não herdam os conectores (Gmail/Supabase são MCP locais/claude.ai) e o Supabase seria via REST+service key. O que funciona hoje é **varredura assistida** (usuário pede "faz a varredura"). Alternativa futura: `/loop` numa sessão Cowork aberta, ou backend próprio.
- Já foram feitas **3 varreduras manuais** (contas pendentes criadas). Categorias novas a usar: Pedágio (Sem Parar), Seguros (PASI/Porto), Combustível (Shell Box), Internet/Telefone (Claro), Aluguel (Gold), etc.

## 6. Folha de Pagamento — REGRAS (o coração do momento)
Fonte: siglas do usuário + **Convenção Coletiva 2026/2027** (Sind. Transportes Carga BH, no Desktop) + **holerites reais** (jul/26).

### Siglas (folha de ponto, planilha por mês, colaboradores × dias)
`SV` saiu de viagem · `CV` chegou de viagem · `V` viajando · `X` dia normal · `FE` férias · `FO` folga · `AT` atestado.

### Cálculos (arquivo `lib/folha.ts`, valida no centavo com holerite do Natanael jul/26)
- **Hora normal = salário ÷ 220.** HE 50% = hora × 1,5. HE 100% = hora × 2.
- **Viagem seg–sáb:** 2h a 50% por dia (SV/CV/V).
- **Viagem domingo/feriado:** **8h**. Regra da folga (a mais recente):
  - **Se há FO (folga) no mês** daquele colaborador → as 8h vão para **50%** (compensado).
  - **Se NÃO há FO no mês** → as 8h vão para **100%** (penalidade). *(hoje é binário "≥1 FO no mês"; confirmar se deve ser folga-a-folga proporcional.)*
- **HE bege:** horas extras do cartão de ponto normal (fora viagem) — campo **manual** por colaborador/mês (editável na tela), soma nas HE 50%.
- **Reflexo DSR** = (total de HE em R$ ÷ dias úteis do mês) × (domingos+feriados). Bateu no holerite (Natanael: R$167,70). Dias úteis = dias do mês − (domingos+feriados). Feriados nacionais em `lib/feriados.ts` (fixos + móveis via Páscoa).
- **VR/Ajuda-alimentação** = R$32 × dias **"X" de segunda a sexta, sem viagem e sem feriado** (exclui sáb/dom/feriado/viagem/ausências).
- **Diária de viagem** = R$100 × dias de viagem (SV+CV+V). Convenção Cláusula 14 (indenizatória; exclui a ajuda-alimentação nos dias de viagem).

### Validado vs a calibrar
- ✅ **HE 50%, HE 100%, Reflexo DSR** — batem no centavo com o holerite.
- 🟡 **VR (R$32) e Diária (R$100)** — regra da convenção. **No holerite a rubrica "9564 AJUDA DE CUSTO TRANSPORTE CONVENÇÃO" tinha valores 450/620/920 que NÃO fecham com 32×dias nem 100×dias.** → **PEDENTE: pegar com o contador a regra/valor exato dessa rubrica** e calibrar.
- 🟡 **VT** — mesma contagem de dias do VR, mas **falta o valor diário do VT** pra calcular (no cadastro só há o desconto mensal = 6% do salário).

### Mapa rubricas ONVIO (a plataforma do contador)
150 HE 50% · 200 HE 100% · 250 Reflexo Extras DSR · 9564 Ajuda Custo Transporte (diária/VR) · 203 Desc. Alimentação · 8111 Desc. Plano Saúde · 48 VT · 283 Consultas Médicas (AT?) · INSS/FGTS/IRRF (sistema).
- **Exportar ONVIO** (botão na Folha) gera **CSV** (colaborador × rubricas). Confirmar se o ONVIO **importa arquivo** (aí a gente gera no layout dele) ou é digitação manual.

### Planilhas geradas (no Desktop do usuário)
- `Folha_de_Ponto_Amitran.xlsx` — modelo (1 aba/mês Ago/26→Dez/27, legenda, dropdown, fins de semana/feriados destacados).
- `Folha_EXEMPLO_Junho2026.xlsx` — exemplo preenchido p/ teste.

## 7. Pendências / próximos passos
1. **Folha — calibrar diária/VR/VT** com o contador (a rubrica "Ajuda de Custo Transporte" 450/620/920; valor diário do VT). Confirmar regra da folga (mês vs proporcional).
2. **ONVIO** — descobrir se importa arquivo; se sim, gerar no layout exato.
3. **Faltas/consultas** — códigos p/ rubricas de falta (8087/8068) e consulta médica (283) se quiserem.
4. **Alerta de DSR** no app (colaborador com muitos dias de viagem sem FO → risco de DSR em dobro).
5. **Margem por mudança** (Processos): valor do deal − custos de terceiro vinculados no Contas a pagar.
6. **Automação diária da Vic** (e-mail) — resolver acesso do conector em execução agendada.
7. **Conciliação Extrato ↔ Vencimentos** (entradas do banco × recebíveis do CRM).
8. **Feriados municipais de BH** (hoje só nacionais).

## 8. Como mexer / publicar
```bash
npm install
npm run dev                 # local
npm run build               # checa tipos + build
git add -A && git commit -m "..." && git push origin main   # publica na Vercel
```
- Migrations: aplicar via MCP do Supabase (apply_migration), **aditivas**, e refletir no arquivo em `supabase/migrations/`.
- Dados sensíveis (colaboradores) → só via SQL no banco, **nunca** no repo.
- Convenção e holerites usados nas regras estão no **Desktop** do usuário (não versionados).
