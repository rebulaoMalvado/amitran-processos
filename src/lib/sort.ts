import type { BoardItem } from './types'

export type SortKey =
  | 'data_desc'
  | 'data_asc'
  | 'valor_desc'
  | 'valor_asc'
  | 'nome_asc'
  | 'recent'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'data_desc', label: 'Data · mais nova' },
  { key: 'data_asc', label: 'Data · mais antiga' },
  { key: 'valor_desc', label: 'Valor · maior' },
  { key: 'valor_asc', label: 'Valor · menor' },
  { key: 'nome_asc', label: 'Nome · A–Z' },
  { key: 'recent', label: 'Atualizado recentemente' },
]

// Datas vazias sempre por último, independentemente da direção.
function cmpDate(a: string | null, b: string | null, dir: 1 | -1): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return dir * a.localeCompare(b)
}

const NUM = (n: number | null | undefined) => Number(n ?? 0)

export function sortItems(items: BoardItem[], key: SortKey): BoardItem[] {
  const copy = [...items]
  switch (key) {
    case 'data_desc':
      return copy.sort((a, b) => cmpDate(a.deal.data_mudanca, b.deal.data_mudanca, -1))
    case 'data_asc':
      return copy.sort((a, b) => cmpDate(a.deal.data_mudanca, b.deal.data_mudanca, 1))
    case 'valor_desc':
      return copy.sort((a, b) => NUM(b.deal.valor) - NUM(a.deal.valor))
    case 'valor_asc':
      return copy.sort((a, b) => NUM(a.deal.valor) - NUM(b.deal.valor))
    case 'nome_asc':
      return copy.sort((a, b) =>
        (a.deal.nome || '').localeCompare(b.deal.nome || '', 'pt-BR', { sensitivity: 'base' }),
      )
    case 'recent':
      return copy.sort((a, b) => b.processo.updated_at.localeCompare(a.processo.updated_at))
    default:
      return copy
  }
}
