import { useMemo } from 'react'
import { brl } from '../lib/format'
import { toYMD } from '../lib/prazos'
import { Icon } from './Icon'

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Item genérico do calendário: uma data (ymd), um valor e se está em aberto.
export interface CalItem {
  ymd: string
  valor: number
  open: boolean
}

interface DayCell {
  date: Date
  ymd: string
  inMonth: boolean
}

export function Calendar({
  month,
  items,
  selectedDay,
  onSelectDay,
  onPrev,
  onNext,
  onToday,
  mode = 'money',
}: {
  month: Date // qualquer dia do mês exibido
  items: CalItem[]
  selectedDay: string | null
  onSelectDay: (ymd: string | null) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  mode?: 'money' | 'dot' // 'dot' = só marca que houve algo no dia (ex.: varredura)
}) {
  const todayYMD = toYMD(new Date())

  // Agrupa por dia (aberto x total).
  const byDay = useMemo(() => {
    const m = new Map<string, { aberto: number; total: number; n: number }>()
    for (const it of items) {
      const cur = m.get(it.ymd) ?? { aberto: 0, total: 0, n: 0 }
      cur.total += Number(it.valor)
      cur.n += 1
      if (it.open) cur.aberto += Number(it.valor)
      m.set(it.ymd, cur)
    }
    return m
  }, [items])

  const cells = useMemo<DayCell[]>(() => {
    const y = month.getFullYear()
    const mo = month.getMonth()
    const first = new Date(y, mo, 1)
    const start = new Date(y, mo, 1 - first.getDay()) // volta até o domingo
    const out: DayCell[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      out.push({ date: d, ymd: toYMD(d), inMonth: d.getMonth() === mo })
    }
    return out
  }, [month])

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="text-[15px] font-bold tracking-tight">
          {MESES[month.getMonth()]} {month.getFullYear()}
        </div>
        <div className="flex-1" />
        <button onClick={onToday} className="rounded-lg border border-border-2 bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-[#F3F5F8]">
          Hoje
        </button>
        <button onClick={onPrev} className="grid h-8 w-8 place-items-center rounded-lg border border-border-2 bg-card text-muted hover:bg-[#F3F5F8]">
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
        </button>
        <button onClick={onNext} className="grid h-8 w-8 place-items-center rounded-lg border border-border-2 bg-card text-muted hover:bg-[#F3F5F8]">
          <Icon name="arrow" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-muted-2">
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          const info = byDay.get(cell.ymd)
          const isToday = cell.ymd === todayYMD
          const isSelected = cell.ymd === selectedDay
          const overdue = info && info.aberto > 0 && cell.ymd < todayYMD
          return (
            <button
              key={cell.ymd}
              onClick={() => onSelectDay(isSelected ? null : cell.ymd)}
              className={
                'flex min-h-[62px] flex-col rounded-lg border p-1.5 text-left transition-colors ' +
                (isSelected
                  ? 'border-primary bg-primary-weak'
                  : 'border-border hover:bg-[#F9FAFB]') +
                (cell.inMonth ? '' : ' opacity-40')
              }
            >
              <span
                className={
                  'text-[11.5px] font-semibold ' +
                  (isToday ? 'grid h-5 w-5 place-items-center rounded-full bg-primary text-white' : 'text-muted')
                }
              >
                {cell.date.getDate()}
              </span>
              {info && mode === 'dot' && (
                <span className="mt-auto flex items-center gap-1" title={`${info.n} varredura(s)`}>
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {info.n > 1 && <span className="text-[10px] font-semibold text-primary">{info.n}</span>}
                </span>
              )}
              {info && mode === 'money' && (
                <span
                  className={
                    'mt-auto truncate rounded px-1 py-0.5 text-[10px] font-semibold ' +
                    (info.aberto > 0
                      ? overdue
                        ? 'bg-[#FCEBEA] text-[#b91c1c]'
                        : 'bg-[#EFF4FF] text-[#2563EB]'
                      : 'bg-[#EAF6EC] text-[#15803d]')
                  }
                  title={`${info.n} conta(s)`}
                >
                  {brl(info.aberto > 0 ? info.aberto : info.total)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
