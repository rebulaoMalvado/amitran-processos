import { supabase } from './supabase'
import type { GmBox, GmLocacao, GmPagamento } from './types'

const BOX_COLS = 'numero, ativo, observacao, created_at, updated_at'
const LOC_COLS =
  'id, box_numero, cliente_nome, volume_m3, valor_mensal, dia_vencimento, data_inicio, data_fim, ativo, obs, created_by, created_at, updated_at'
const PAG_COLS =
  'id, locacao_id, mes_referencia, valor, pago, data_pagamento, obs, created_by, created_at, updated_at'

export async function fetchBoxes(): Promise<GmBox[]> {
  const { data, error } = await supabase
    .from('gm_boxes')
    .select(BOX_COLS)
    .order('numero', { ascending: true })
  if (error) throw error
  return (data as GmBox[]) ?? []
}

export async function fetchLocacoes(): Promise<GmLocacao[]> {
  const { data, error } = await supabase
    .from('gm_locacoes')
    .select(LOC_COLS)
    .order('box_numero', { ascending: true })
  if (error) throw error
  return (data as GmLocacao[]) ?? []
}

export async function fetchPagamentos(): Promise<GmPagamento[]> {
  const { data, error } = await supabase
    .from('gm_pagamentos')
    .select(PAG_COLS)
    .order('mes_referencia', { ascending: false })
  if (error) throw error
  return (data as GmPagamento[]) ?? []
}

export type NewLocacao = {
  box_numero: number
  cliente_nome: string
  volume_m3: number | null
  valor_mensal: number | null
  dia_vencimento: number | null
  data_inicio: string | null
  obs: string | null
  created_by: string | null
}

export async function insertLocacao(row: NewLocacao): Promise<GmLocacao> {
  const { data, error } = await supabase.from('gm_locacoes').insert(row).select(LOC_COLS).single()
  if (error) throw error
  return data as GmLocacao
}

export async function updateLocacao(id: string, patch: Partial<GmLocacao>): Promise<void> {
  const { error } = await supabase.from('gm_locacoes').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteLocacao(id: string): Promise<void> {
  const { error } = await supabase.from('gm_locacoes').delete().eq('id', id)
  if (error) throw error
}

export async function updateBox(numero: number, patch: Partial<GmBox>): Promise<void> {
  const { error } = await supabase.from('gm_boxes').update(patch).eq('numero', numero)
  if (error) throw error
}

// Marca (ou desmarca) um mês como pago. Upsert por (locacao_id, mes_referencia).
export type PagamentoUpsert = {
  locacao_id: string
  mes_referencia: string
  valor: number
  pago: boolean
  data_pagamento: string | null
  created_by: string | null
}

export async function upsertPagamento(row: PagamentoUpsert): Promise<GmPagamento> {
  const { data, error } = await supabase
    .from('gm_pagamentos')
    .upsert(row, { onConflict: 'locacao_id,mes_referencia' })
    .select(PAG_COLS)
    .single()
  if (error) throw error
  return data as GmPagamento
}
