import { supabase } from './supabase'
import type { Installment } from './types'

// Parcela + nome do cliente (deal). Só leitura: reflete o que o CRM tem.
export interface Vencimento extends Installment {
  deal_nome: string | null
}

export async function fetchVencimentos(): Promise<Vencimento[]> {
  const { data, error } = await supabase
    .from('deal_installments')
    .select(
      'id, deal_id, installment_number, amount, due_date, is_received, received_date, received_amount, deals(nome)',
    )
    .order('due_date', { ascending: true })
  if (error) throw error
  // `deals` vem como objeto (FK to-one) ou null sob RLS.
  return (data ?? []).map((r: Record<string, unknown>) => {
    const deal = r.deals as { nome?: string } | null
    return {
      id: r.id as string,
      deal_id: r.deal_id as string,
      installment_number: r.installment_number as number,
      amount: Number(r.amount),
      due_date: r.due_date as string,
      is_received: r.is_received as boolean,
      received_date: (r.received_date as string) ?? null,
      received_amount: r.received_amount != null ? Number(r.received_amount) : null,
      deal_nome: deal?.nome ?? null,
    }
  })
}
