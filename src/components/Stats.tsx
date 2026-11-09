import { useMemo } from 'react'
import { brl } from '../lib/format'
import type { BoardItem, Installment } from '../lib/types'
import { Icon } from './Icon'

// Parcela em atraso: não recebida e vencida.
export function isLate(inst: Installment): boolean {
  if (inst.is_received) return false
  const due = new Date(inst.due_date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

// Saldo a receber de um item (parcelas em aberto; senão o valor do deal).
export function aReceber(item: BoardItem): number {
  if (item.installments.length) {
    return item.installments
      .filter((i) => !i.is_received)
      .reduce((s, i) => s + Number(i.amount), 0)
  }
  return Number(item.deal.valor ?? 0)
}

export function Stats({ items }: { items: BoardItem[] }) {
  const s = useMemo(() => {
    const nF = items.filter((i) => i.processo.status === 'fechadas').length
    const vFat = items
      .filter((i) => i.processo.status === 'faturamento')
      .reduce((sum, i) => sum + Number(i.deal.valor ?? 0), 0)
    const acomp = items.filter((i) => i.processo.status === 'acompanhamento')
    const vRec = acomp.reduce((sum, i) => sum + aReceber(i), 0)
    const late = acomp.filter((i) => i.installments.some(isLate)).length
    const nR = items.filter((i) => i.processo.status === 'recebido').length
    return { nF, vFat, vRec, late, nR }
  }, [items])

  const cards = [
    { k: 'Mudanças fechadas', v: String(s.nF), ic: 'box' as const, bg: '#EEF0FE', fg: '#6366F1' },
    { k: 'Em faturamento', v: brl(s.vFat), ic: 'file' as const, bg: '#FEF6E3', fg: '#CA8A04' },
    {
      k: 'A receber',
      v: brl(s.vRec),
      ic: 'wallet' as const,
      bg: '#EFF4FF',
      fg: '#3B82F6',
      sub: s.late > 0 ? ` · ${s.late} em atraso` : '',
      alert: s.late > 0,
    },
    { k: 'Recebido / baixado', v: String(s.nR), ic: 'check' as const, bg: '#EAF6EC', fg: '#16A34A' },
  ]

  return (
    <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.k}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm"
        >
          <span
            className="grid h-9 w-9 flex-none place-items-center rounded-[10px]"
            style={{ background: c.bg, color: c.fg }}
          >
            <Icon name={c.ic} className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[11.5px] font-medium text-muted">{c.k}</div>
            <div
              className="flex flex-wrap items-baseline gap-x-1.5 text-[20px] font-bold leading-tight tracking-tight"
              style={c.alert ? { color: '#EF4444' } : undefined}
            >
              <span>{c.v}</span>
              {c.sub ? (
                <small className="whitespace-nowrap text-[12px] font-medium text-muted-2">{c.sub.replace(/^ · /, '')}</small>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
