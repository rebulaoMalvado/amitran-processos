// Regras de status/cores do mapa do Guarda-móveis.
import type { GmLocacao, GmPagamento } from './types'

// Status de pagamento de UMA locação num mês.
export type LocStatus = 'pago' | 'vencido' | 'proximo' | 'aberto'
// Status agregado do BOX (inclui vago).
export type BoxStatus = LocStatus | 'vago'

// Mês de referência 1º dia -> "YYYY-MM-01".
export function mesRef(ano: number, mes0: number): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${ano}-${p(mes0 + 1)}-01`
}

export function mesRefFromDate(d: Date): string {
  return mesRef(d.getFullYear(), d.getMonth())
}

// Último dia do mês (para clamp do dia de vencimento).
function lastDayOfMonth(ano: number, mes0: number): number {
  return new Date(ano, mes0 + 1, 0).getDate()
}

// Data de vencimento efetiva da locação naquele mês (clampa dia 31 em fev etc).
export function vencimentoDoMes(dia: number, mesReferencia: string): Date {
  const [ano, mes] = mesReferencia.split('-').map(Number)
  const mes0 = mes - 1
  const d = Math.min(dia, lastDayOfMonth(ano, mes0))
  return new Date(ano, mes0, d)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Status de uma locação, para um mês, em relação a "hoje".
export function statusLocacao(
  loc: GmLocacao,
  pag: GmPagamento | undefined,
  mesReferencia: string,
  hoje: Date,
): LocStatus {
  if (pag?.pago) return 'pago'
  // Sem dia de vencimento definido -> não dá pra medir proximidade: fica "aberto".
  if (!loc.dia_vencimento) return 'aberto'
  const venc = vencimentoDoMes(loc.dia_vencimento, mesReferencia)
  const h = startOfDay(hoje)
  const diffDias = Math.round((venc.getTime() - h.getTime()) / 86400000)
  if (diffDias < 0) return 'vencido'
  if (diffDias <= 5) return 'proximo'
  return 'aberto'
}

// Pior status entre as locações ativas do box (vencido > proximo > aberto > pago).
const RANK: Record<LocStatus, number> = { vencido: 4, proximo: 3, aberto: 2, pago: 1 }

export function statusBox(statuses: LocStatus[]): BoxStatus {
  if (!statuses.length) return 'vago'
  return statuses.reduce((worst, s) => (RANK[s] > RANK[worst] ? s : worst), statuses[0])
}

export const STATUS_LABEL: Record<BoxStatus, string> = {
  pago: 'Pago',
  vencido: 'Atrasado',
  proximo: 'Vence em breve',
  aberto: 'Em aberto',
  vago: 'Vago',
}
