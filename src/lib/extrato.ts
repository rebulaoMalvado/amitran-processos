import { supabase } from './supabase'
import { nowISO } from './format'
import type { ContaPagar, ExtratoTransacao } from './types'
import type { OfxTransacao } from './ofx'

const COLS =
  'id, fitid, acctid, bankid, data, valor, tipo, descricao, conferido, conferido_by, conferido_at, conta_id, created_by, created_at'

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

// Concilia uma saída do extrato com uma conta a pagar: liga as duas, marca a
// transação como conferida e dá baixa na conta (status paga).
export async function conciliar(
  tx: ExtratoTransacao,
  conta: ContaPagar,
  userId: string | null,
): Promise<void> {
  const { error: e1 } = await supabase
    .from('extrato_transacoes')
    .update({ conta_id: conta.id, conferido: true, conferido_by: userId, conferido_at: nowISO() })
    .eq('id', tx.id)
  if (e1) throw e1

  const log = [
    { who: userId ?? '', txt: 'conciliado com o extrato (baixa automática)', at: nowISO() },
    ...(conta.log ?? []),
  ]
  const { error: e2 } = await supabase
    .from('contas_pagar')
    .update({ status: 'paga', pago_em: tx.data, valor_pago: Math.abs(Number(tx.valor)), log })
    .eq('id', conta.id)
  if (e2) throw e2
}

// Desfaz a conciliação: desliga o vínculo e reabre a conta.
export async function desconciliar(
  tx: ExtratoTransacao,
  conta: ContaPagar | undefined,
  userId: string | null,
): Promise<void> {
  const { error: e1 } = await supabase
    .from('extrato_transacoes')
    .update({ conta_id: null, conferido: false, conferido_by: null, conferido_at: null })
    .eq('id', tx.id)
  if (e1) throw e1
  if (conta) {
    const log = [
      { who: userId ?? '', txt: 'desfez a conciliação (reaberta)', at: nowISO() },
      ...(conta.log ?? []),
    ]
    const { error: e2 } = await supabase
      .from('contas_pagar')
      .update({ status: 'aberta', pago_em: null, valor_pago: null, log })
      .eq('id', conta.id)
    if (e2) throw e2
  }
}
