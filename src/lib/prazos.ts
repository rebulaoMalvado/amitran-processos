import type { ContaPagar } from './types'

// Data local -> 'YYYY-MM-DD' (sem fuso).
export function toYMD(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Soma dias a uma data 'YYYY-MM-DD' e devolve 'YYYY-MM-DD'.
export function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toYMD(d)
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// N-ésimo dia útil (seg–sex) de um mês. NÃO considera feriados.
export function nthBusinessDay(year: number, monthIndex: number, n: number): Date {
  let count = 0
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, monthIndex, day)
    if (d.getMonth() !== monthIndex) break
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      count++
      if (count === n) return d
    }
  }
  return new Date(year, monthIndex + 1, 0) // fallback: último dia do mês
}

// Próxima ocorrência do N-ésimo dia útil (este mês se ainda não passou; senão o próximo).
export function nextNthBusinessDay(n: number): Date {
  const today = startOfToday()
  const thisMonth = nthBusinessDay(today.getFullYear(), today.getMonth(), n)
  if (today <= thisMonth) return thisMonth
  return nthBusinessDay(today.getFullYear(), today.getMonth() + 1, n)
}

// Próxima ocorrência de um dia do mês (ex.: dia 20).
export function nextDayOfMonth(day: number): Date {
  const today = startOfToday()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), day)
  if (today <= thisMonth) return thisMonth
  return new Date(today.getFullYear(), today.getMonth() + 1, day)
}

// Soma (e conta) das contas ABERTAS que vencem até `limite` (inclui vencidas).
export function abertasAte(
  contas: ContaPagar[],
  limite: Date,
): { total: number; n: number } {
  const ymd = toYMD(limite)
  const alvo = contas.filter((c) => c.status === 'aberta' && c.vencimento <= ymd)
  return {
    total: alvo.reduce((s, c) => s + Number(c.valor), 0),
    n: alvo.length,
  }
}
