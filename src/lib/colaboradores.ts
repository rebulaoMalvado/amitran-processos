import { supabase } from './supabase'
import type { Colaborador } from './types'

const COLS =
  'id, codigo, nome, apelido, funcao, cbo, salario_base, admissao, plano_saude, alimentacao, vale_transporte, ativo, obs, created_at, updated_at'

export async function fetchColaboradores(): Promise<Colaborador[]> {
  const { data, error } = await supabase
    .from('colaboradores')
    .select(COLS)
    .order('nome', { ascending: true })
  if (error) throw error
  return (data as Colaborador[]) ?? []
}

export type ColaboradorInput = Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>

export async function insertColaborador(
  row: Partial<ColaboradorInput> & { created_by?: string | null },
): Promise<Colaborador> {
  const { data, error } = await supabase.from('colaboradores').insert(row).select(COLS).single()
  if (error) throw error
  return data as Colaborador
}

export async function updateColaborador(id: string, patch: Partial<Colaborador>): Promise<void> {
  const { error } = await supabase.from('colaboradores').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteColaborador(id: string): Promise<void> {
  const { error } = await supabase.from('colaboradores').delete().eq('id', id)
  if (error) throw error
}
