// Tipos do domínio. As tabelas existentes (deals, deal_installments, profiles)
// são compartilhadas com o CRM; aqui declaramos só o que este app consome.

export type Role = 'vendedor' | 'head'

export interface Profile {
  id: string
  email: string
  name: string | null
  role: Role
  created_at: string | null
}

// Status = as 4 abas/colunas do board.
export type ProcessoStatus =
  | 'fechadas'
  | 'faturamento'
  | 'acompanhamento'
  | 'recebido'

// Entrada de campo assinada: quem preencheu/marcou e quando.
// Campos bool guardam { by, at }; campos de texto/select guardam { value, by, at }.
export interface FieldEntry {
  value?: string
  by: string // profile id (auth.users.id)
  at: string // ISO timestamp
}

export interface ObsNote {
  by: string
  at: string
  text: string
}

export interface LogEntry {
  who: string // profile id
  txt: string
  at: string // ISO timestamp
}

// Linha da tabela `processos` (migration nova, aditiva).
export interface Processo {
  id: string
  deal_id: string
  status: ProcessoStatus
  campos: Record<string, FieldEntry>
  obs: Record<string, ObsNote[]> // por aba
  log: LogEntry[]
  created_at: string
  updated_at: string
}

// Campos do deal reaproveitados no board (FK deal_id -> deals.id).
export interface Deal {
  id: string
  nome: string
  telefone: string | null
  origem: string | null
  destino: string | null
  data_mudanca: string | null
  tipo_servico: 'economico' | 'completo' | null
  valor: number | null
  stage: string
  parceiro: string | null
  seller_id: string | null
}

// Parcela existente (tabela deal_installments) — reaproveitada no acompanhamento.
export interface Installment {
  id: string
  deal_id: string
  installment_number: number
  amount: number
  due_date: string
  is_received: boolean
  received_date: string | null
  received_amount: number | null
}

// Item denormalizado que o board consome.
export interface BoardItem {
  processo: Processo
  deal: Deal
  installments: Installment[]
}

// ---- Contas a pagar (módulo Financeiro) ----
export type ContaCategoria =
  | 'embalagem'
  | 'manutencao'
  | 'combustivel'
  | 'imposto'
  | 'terceirizacao'
  | 'aluguel'
  | 'folha'
  | 'chapas'
  | 'retirada'
  | 'internet_telefone'
  | 'seguros'
  | 'pedagio'
  | 'marketing'
  | 'diversos'

export type ContaStatus = 'pendente' | 'aberta' | 'paga'

export interface ContaPagar {
  id: string
  descricao: string
  categoria: ContaCategoria
  favorecido: string | null
  deal_id: string | null
  valor: number
  vencimento: string
  status: ContaStatus
  forma_pagamento: string | null
  pago_em: string | null
  valor_pago: number | null
  obs: string | null
  log: LogEntry[]
  origem: string // 'manual' | 'email'
  created_by: string | null
  created_at: string
  updated_at: string
}

// Opção enxuta de deal para o seletor de vínculo.
export interface DealOption {
  id: string
  nome: string
  valor: number | null
  data_mudanca: string | null
}

// ---- Frota / Manutenção ----
export interface Caminhao {
  id: string
  placa: string
  modelo: string | null
  apelido: string | null
  ano: number | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Manutencao {
  id: string
  caminhao_id: string
  descricao: string
  data: string
  valor: number
  obs: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Colaborador (Departamento Pessoal).
export interface Colaborador {
  id: string
  codigo: string | null
  nome: string
  apelido: string | null
  funcao: string | null
  cbo: string | null
  salario_base: number
  admissao: string | null
  plano_saude: number
  alimentacao: number
  vale_transporte: number
  ativo: boolean
  obs: string | null
  created_at: string
  updated_at: string
}

// Transação de extrato bancário importada (OFX).
export interface ExtratoTransacao {
  id: string
  fitid: string
  acctid: string
  bankid: string | null
  data: string
  valor: number
  tipo: string | null
  descricao: string | null
  conferido: boolean
  conferido_by: string | null
  conferido_at: string | null
  conta_id: string | null
  created_by: string | null
  created_at: string
}

// Post do agente no Mural do Claude.
export interface ClaudeUpdate {
  id: string
  tipo: string
  titulo: string
  resumo: string | null
  payload: Record<string, unknown>
  created_at: string
}
