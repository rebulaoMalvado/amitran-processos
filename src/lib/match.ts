import type { ContaPagar, ExtratoTransacao } from './types'

// Normaliza nome: minúsculas, sem acento, sem pontuação, espaços colapsados.
export function normalizeName(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos (acentos)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[n]
}

// Similaridade de nome (0..1): fração dos tokens de `a` com correspondência
// próxima em `b` (igual, contido, ou Levenshtein <= 1 — pega luis/luiz).
export function nameSimilarity(a: string, b: string): number {
  const at = normalizeName(a).split(' ').filter((t) => t.length >= 3)
  const bt = normalizeName(b).split(' ').filter(Boolean)
  if (!at.length || !bt.length) return 0
  let matched = 0
  for (const t of at) {
    if (bt.some((u) => u === t || u.includes(t) || t.includes(u) || levenshtein(t, u) <= 1)) {
      matched++
    }
  }
  return matched / at.length
}

function daysBetween(ymdA: string, ymdB: string): number {
  const a = new Date(ymdA + 'T00:00:00').getTime()
  const b = new Date(ymdB + 'T00:00:00').getTime()
  return Math.abs(Math.round((a - b) / 86400000))
}

export interface MatchResult {
  conta: ContaPagar
  score: number
  dias: number
  nome: number
  confianca: 'alta' | 'media' | 'baixa'
}

// Melhor conta a pagar que casa com uma saída do extrato (tx.valor < 0).
// Exige valor igual (tolerância de centavo); pontua por data próxima + nome.
export function bestContaMatch(
  tx: ExtratoTransacao,
  contas: ContaPagar[],
): MatchResult | null {
  if (tx.valor >= 0) return null
  const valorAbs = Math.abs(Number(tx.valor))
  let best: MatchResult | null = null
  for (const c of contas) {
    const cv = Number(c.valor)
    if (cv <= 0 || Math.abs(cv - valorAbs) > 0.01) continue // valor tem que bater
    const dias = daysBetween(c.vencimento, tx.data)
    const nome = nameSimilarity(c.favorecido || c.descricao || '', tx.descricao || '')
    const dateScore = Math.max(0, 1 - dias / 15) // 1 no mesmo dia, 0 em 15+ dias
    const score = 0.6 * dateScore + 0.4 * nome
    if (!best || score > best.score) {
      const confianca: MatchResult['confianca'] =
        dias <= 5 && (nome >= 0.5 || dias <= 1)
          ? 'alta'
          : dias <= 10 || nome >= 0.5
            ? 'media'
            : 'baixa'
      best = { conta: c, score, dias, nome, confianca }
    }
  }
  return best
}
