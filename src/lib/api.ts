import { supabase } from './supabase'
import type {
  BoardItem,
  ClaudeUpdate,
  Deal,
  Installment,
  Processo,
  ProcessoStatus,
  Profile,
} from './types'

const DEAL_COLS =
  'id, nome, telefone, origem, destino, data_mudanca, tipo_servico, valor, stage, parceiro'
const PROC_COLS = 'id, deal_id, status, campos, obs, log, created_at, updated_at'
const INST_COLS =
  'id, deal_id, installment_number, amount, due_date, is_received, received_date, received_amount'

export async function fetchClaudeUpdates(): Promise<ClaudeUpdate[]> {
  const { data, error } = await supabase
    .from('claude_updates')
    .select('id, tipo, titulo, resumo, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data as ClaudeUpdate[]) ?? []
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, created_at')
  if (error) throw error
  return (data as Profile[]) ?? []
}

// Carrega o board: deals fechados + seus processos (materializando os que faltam)
// + parcelas. Retorna itens denormalizados prontos pra render.
export async function loadBoard(): Promise<BoardItem[]> {
  const { data: dealsData, error: dErr } = await supabase
    .from('deals')
    .select(DEAL_COLS)
    .eq('stage', 'fechado')
  if (dErr) throw dErr
  const deals = (dealsData as Deal[]) ?? []
  if (!deals.length) return []

  const dealIds = deals.map((d) => d.id)

  const { data: procData, error: pErr } = await supabase
    .from('processos')
    .select(PROC_COLS)
    .in('deal_id', dealIds)
  if (pErr) throw pErr
  let processos = (procData as Processo[]) ?? []

  // Materializa 1 processo por deal fechado que ainda não tem (idempotente).
  const withProc = new Set(processos.map((p) => p.deal_id))
  const missing = dealIds.filter((id) => !withProc.has(id))
  if (missing.length) {
    const { data: inserted, error: iErr } = await supabase
      .from('processos')
      .upsert(
        missing.map((deal_id) => ({ deal_id, status: 'fechadas' as ProcessoStatus })),
        { onConflict: 'deal_id', ignoreDuplicates: true },
      )
      .select(PROC_COLS)
    if (iErr) throw iErr
    processos = processos.concat((inserted as Processo[]) ?? [])
  }

  const { data: instData, error: instErr } = await supabase
    .from('deal_installments')
    .select(INST_COLS)
    .in('deal_id', dealIds)
    .order('installment_number', { ascending: true })
  if (instErr) throw instErr
  const installments = (instData as Installment[]) ?? []

  const dealById = new Map(deals.map((d) => [d.id, d]))
  const instByDeal = new Map<string, Installment[]>()
  for (const i of installments) {
    const arr = instByDeal.get(i.deal_id) ?? []
    arr.push(i)
    instByDeal.set(i.deal_id, arr)
  }

  return processos
    .filter((p) => dealById.has(p.deal_id))
    .map((processo) => ({
      processo,
      deal: dealById.get(processo.deal_id)!,
      installments: instByDeal.get(processo.deal_id) ?? [],
    }))
}

// Persiste os campos jsonb + status de um processo.
export async function saveProcesso(
  id: string,
  patch: Partial<Pick<Processo, 'campos' | 'obs' | 'log' | 'status'>>,
): Promise<void> {
  const { error } = await supabase.from('processos').update(patch).eq('id', id)
  if (error) throw error
}
