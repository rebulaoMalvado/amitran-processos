import { supabase } from './supabase'
import type { Caminhao, Manutencao } from './types'

const CAM_COLS = 'id, placa, modelo, apelido, ano, ativo, created_by, created_at, updated_at'
const MAN_COLS =
  'id, caminhao_id, descricao, data, valor, obs, created_by, created_at, updated_at'

export async function fetchCaminhoes(): Promise<Caminhao[]> {
  const { data, error } = await supabase
    .from('caminhoes')
    .select(CAM_COLS)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as Caminhao[]) ?? []
}

export async function fetchManutencoes(): Promise<Manutencao[]> {
  const { data, error } = await supabase
    .from('manutencoes')
    .select(MAN_COLS)
    .order('data', { ascending: false })
  if (error) throw error
  return (data as Manutencao[]) ?? []
}

export type NewCaminhao = {
  placa: string
  modelo: string | null
  apelido: string | null
  ano: number | null
  created_by: string | null
}

export async function insertCaminhao(row: NewCaminhao): Promise<Caminhao> {
  const { data, error } = await supabase.from('caminhoes').insert(row).select(CAM_COLS).single()
  if (error) throw error
  return data as Caminhao
}

export async function updateCaminhao(id: string, patch: Partial<Caminhao>): Promise<void> {
  const { error } = await supabase.from('caminhoes').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCaminhao(id: string): Promise<void> {
  const { error } = await supabase.from('caminhoes').delete().eq('id', id)
  if (error) throw error
}

export type NewManutencao = {
  caminhao_id: string
  descricao: string
  data: string
  valor: number
  obs: string | null
  created_by: string | null
}

export async function insertManutencao(row: NewManutencao): Promise<Manutencao> {
  const { data, error } = await supabase.from('manutencoes').insert(row).select(MAN_COLS).single()
  if (error) throw error
  return data as Manutencao
}

export async function deleteManutencao(id: string): Promise<void> {
  const { error } = await supabase.from('manutencoes').delete().eq('id', id)
  if (error) throw error
}
