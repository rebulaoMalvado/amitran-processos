import { supabase } from './supabase'
import type { ContaCategoria, ContaPagar, DealOption } from './types'

const CONTA_COLS =
  'id, descricao, categoria, favorecido, deal_id, valor, vencimento, status, forma_pagamento, pago_em, valor_pago, obs, log, origem, created_by, created_at, updated_at'

// Metadados de categoria (rótulo + cor do badge).
export const CATEGORIAS: Record<ContaCategoria, { label: string; color: string; bg: string }> = {
  terceiro: { label: 'Terceiro', color: '#92610a', bg: '#FEF6E3' },
  fornecedor: { label: 'Fornecedor', color: '#1e4b8f', bg: '#EAF1FC' },
  fixa: { label: 'Despesa fixa', color: '#6d28d9', bg: '#F3EEFE' },
  imposto_veiculo: { label: 'Imposto / Veículo', color: '#b91c1c', bg: '#FCEBEA' },
  outro: { label: 'Outro', color: '#475569', bg: '#F1F3F6' },
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
