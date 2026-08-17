import { supabase } from './supabase'
import type { ExtratoTransacao } from './types'
import type { OfxTransacao } from './ofx'

const COLS =
  'id, fitid, acctid, bankid, data, valor, tipo, descricao, conferido, conferido_by, conferido_at, created_by, created_at'

export async function fetchExtrato(): Promise<ExtratoTransacao[]> {
  const { data, error } = await supabase
    .from('extrato_transacoes')
    .select(COLS)
    .order('data', { ascending: false })
  if (error) throw error
  return (data as ExtratoTransacao[]) ?? []
}

// Importa as transações do OFX. Dedup por (acctid, fitid): reimportar não duplica.
// Retorna quantas linhas novas foram inseridas.
export async function importarTransacoes(
  txs: OfxTransacao[],
  createdBy: string | null,
): Promise<number> {
  if (!txs.length) return 0
  const rows = txs.map((t) => ({
    fitid: t.fitid,
    acctid: t.acctid,
    bankid: t.bankid || null,
    data: t.data,
    valor: t.valor,
    tipo: t.tipo || null,
    descricao: t.descricao || null,
    created_by: createdBy,
  }))
  const { data, error } = await supabase
    .from('extrato_transacoes')
    .upsert(rows, { onConflict: 'acctid,fitid', ignoreDuplicates: true })
    .select('id')
  if (error) throw error
  return (data as { id: string }[])?.length ?? 0
}

export async function setConferido(
  id: string,
  conferido: boolean,
  userId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('extrato_transacoes')
    .update({
      conferido,
      conferido_by: conferido ? userId : null,
      conferido_at: conferido ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTransacao(id: string): Promise<void> {
  const { error } = await supabase.from('extrato_transacoes').delete().eq('id', id)
  if (error) throw error
}
