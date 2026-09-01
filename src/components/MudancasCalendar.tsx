import { useMemo, useState } from 'react'
import { ABAS } from '../lib/board'
import { brl, fmtDay } from '../lib/format'
import type { BoardItem, Profile } from '../lib/types'
import { Calendar } from './Calendar'
import { Icon } from './Icon'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// Calendário das mudanças com data lançada — previsão (fechadas) e histórico
// (as que já passaram para faturamento/acompanhamento/recebido). Marca os dias
// em que há mudança (frota própria ou terceirizada) e lista os detalhes do dia
// selecionado — ou do mês inteiro, se nada estiver selecionado.
export function MudancasCalendar({
  items,
  profiles,
  onOpen,
}: {
  items: BoardItem[]
  profiles: Record<string, Profile>
  onOpen: (id: string) => void
}) {
  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Toda mudança com data lançada — fechadas (previsão) e as já executadas.
  const mudancas = useMemo(
    () => items.filter((i) => !!i.deal.data_mudanca),
    [items],
  )

  const calItems = useMemo(
    () => mudancas.map((i) => ({ ymd: i.deal.data_mudanca as string, valor: 1, open: true })),
    [mudancas],
  )

  // Lista mostrada abaixo do calendário.
  const lista = useMemo(() => {
    const y = month.getFullYear()
    const mo = month.getMonth()
    const filtered = selectedDay
      ? mudancas.filter((i) => i.deal.data_mudanca === selectedDay)
      : mudancas.filter((i) => {
          const d = new Date((i.deal.data_mudanca as string) + 'T00:00:00')
          return d.getFullYear() === y && d.getMonth() === mo
        })
    return [...filtered].sort((a, b) =>
      (a.deal.data_mudanca as string).localeCompare(b.deal.data_mudanca as string),
    )
  }, [mudancas, month, selectedDay])

  const tituloLista = selectedDay
    ? `Mudanças em ${fmtDay(selectedDay)}`
    : `Mudanças de ${MESES[month.getMonth()]}`

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 pb-6">
      <Calendar
        mode="dot"
        month={month}
        items={calItems}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onPrev={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onNext={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        onToday={() => setMonth(new Date())}
      />

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-2">
            {tituloLista}
          </span>
          <span className="rounded-full border border-border bg-[#F3F5F8] px-2 py-px text-[11px] font-semibold text-muted">
            {lista.length}
          </span>
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="ml-auto text-[12px] font-medium text-primary hover:underline"
            >
              ver o mês
            </button>
          )}
        </div>

        {lista.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-muted-2">
            {selectedDay
              ? `Nenhuma mudança em ${fmtDay(selectedDay)}.`
              : 'Nenhuma mudança com data lançada neste mês.'}
          </div>
        ) : (
          lista.map((item) => {
            const { deal, processo } = item
            const terceirizado = !!(deal.parceiro && deal.parceiro.trim())
            const vendedor = deal.seller_id ? profiles[deal.seller_id]?.name ?? null : null
            const aba = ABAS[processo.status]
            const previsto = processo.status === 'fechadas'
            return (
              <button
                key={processo.id}
                onClick={() => onOpen(processo.id)}
                className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#F9FAFB]"
              >
                <span
                  className="grid h-10 w-10 flex-none place-items-center rounded-xl text-white"
                  style={{ background: aba.color }}
                  title={`${aba.label} · ${fmtDay(deal.data_mudanca)}`}
                >
                  <Icon name="calendar" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{deal.nome}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                    <Icon name="map" className="h-3 w-3 flex-none text-muted-2" />
                    <span className="truncate">{deal.origem || '—'}</span>
                    <Icon name="arrow" className="h-3 w-3 flex-none text-muted-2" />
                    <span className="truncate">{deal.destino || '—'}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ' +
                        (terceirizado
                          ? 'border-[#F6E0A6] bg-[#FEF6E3] text-[#92610a]'
                          : 'border-border bg-[#F3F5F8] text-muted')
                      }
                    >
                      <Icon name="truck" className="h-3 w-3" />
                      {terceirizado ? `Terceiro · ${deal.parceiro}` : 'Frota própria'}
                    </span>
                    {vendedor && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-2">
                        <Icon name="users" className="h-3 w-3" />
                        {vendedor}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-0.5">
                  <span className="text-[13px] font-bold tracking-tight">{brl(deal.valor)}</span>
                  <span className="text-[11px] font-medium text-muted-2">
                    {previsto ? 'prev. ' : 'exec. '}
                    {fmtDay(deal.data_mudanca)}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
