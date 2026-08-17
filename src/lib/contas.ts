import { supabase } from './supabase'
import type { ContaCategoria, ContaPagar, DealOption } from './types'

const CONTA_COLS =
  'id, descricao, categoria, favorecido, deal_id, valor, vencimento, status, forma_pagamento, pago_em, valor_pago, obs, log, origem, created_by, created_at, updated_at'

// Metadados de categoria (rótulo + cor do badge).
export const CATEGORIAS: Record<ContaCategoria, { label: string; color: string; bg: string }> = {
  embalagem: { label: 'Embalagem', color: '#085041', bg: '#E1F5EE' },
  manutencao: { label: 'Manutenção', color: '#633806', bg: '#FAEEDA' },
  imposto: { label: 'Imposto', color: '#791F1F', bg: '#FCEBEB' },
  terceirizacao: { label: 'Terceirização', color: '#3C3489', bg: '#EEEDFE' },
  aluguel: { label: 'Aluguel', color: '#0C447C', bg: '#E6F1FB' },
  folha: { label: 'Folha de pagamento', color: '#72243E', bg: '#FBEAF0' },
  chapas: { label: 'Chapas', color: '#712B13', bg: '#FAECE7' },
  retirada: { label: 'Retirada', color: '#27500A', bg: '#EAF3DE' },
  internet_telefone: { label: 'Internet / Telefone', color: '#185FA5', bg: '#E6F1FB' },
  seguros: { label: 'Seguros', color: '#534AB7', bg: '#EEEDFE' },
  pedagio: { label: 'Pedágio', color: '#BA7517', bg: '#FAEEDA' },
  diversos: { label: 'Diversos', color: '#475569', bg: '#F1F3F6' },
}

export const CATEGORIA_KEYS = Object.keys(CATEGORIAS) as ContaCategoria[]

export const FORMAS_PAGAMENTO = [
  'Boleto',
  'Pix',
  'Portal / Faturamento',
  'Cartão de Crédito',
  'Dinheiro',
  'Transferência',
]

export async function fetchContas(): Promise<ContaPagar[]> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .select(CONTA_COLS)
    .order('vencimento', { ascending: true })
  if (error) throw error
  return (data as ContaPagar[]) ?? []
}

// Deals fechados para o seletor de vínculo (custo de terceiro por mudança).
export async function fetchDealOptions(): Promise<DealOption[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('id, nome, valor, data_mudanca')
    .eq('stage', 'fechado')
    .order('data_mudanca', { ascending: false })
  if (error) throw error
  return (data as DealOption[]) ?? []
}

export type NewConta = Omit<
  ContaPagar,
  'id' | 'created_at' | 'updated_at' | 'log' | 'status' | 'pago_em' | 'valor_pago' | 'origem'
> & { log: ContaPagar['log'] }

export async function insertConta(row: NewConta): Promise<ContaPagar> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .insert(row)
    .select(CONTA_COLS)
    .single()
  if (error) throw error
  return data as ContaPagar
}

export async function updateConta(
  id: string,
  patch: Partial<ContaPagar>,
): Promise<void> {
  const { error } = await supabase.from('contas_pagar').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteConta(id: string): Promise<void> {
  const { error } = await supabase.from('contas_pagar').delete().eq('id', id)
  if (error) throw error
}
