import { useEffect, useMemo, useState } from 'react'
import { brl, fmtDay } from '../lib/format'
import { nextDayOfMonth, nextNthBusinessDay, toYMD } from '../lib/prazos'
import { fetchVencimentos, type Vencimento } from '../lib/vencimentos'
import { Calendar } from './Calendar'
import { Icon } from './Icon'

const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MES_ABREV[Number(m) - 1]}/${y}`
}

type Filter = 'a_receber' | 'atrasadas' | 'recebidas' | 'todas'
type ViewMode = 'lista' | 'calendario'

function isOverdue(v: Vencimento): boolean {
  return !v.is_received && v.due_date < toYMD(new Date())
}

export function VencimentosView() {
  const [vencs, setVencs] = useState<Vencimento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<Filter>('a_receber')
  const [viewMode, setViewMode] = useState<ViewMode>('lista')
  const [calMonth, setCalMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    fetchVencimentos()
      .then((v) => {
        setVencs(v)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  // Total de parcelas por deal (para exibir n/total).
  const totalByDeal = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of vencs) m.set(v.deal_id, Math.max(m.get(v.deal_id) ?? 0, v.installment_number))
    return m
  }, [vencs])

  const stats = useMemo(() => {
    const abertas = vencs.filter((v) => !v.is_received)
    const atrasadas = abertas.filter(isOverdue)
    const recebidas = vencs.filter((v) => v.is_received)
    return {
      aberto: abertas.reduce((s, v) => s + v.amount, 0),
      nAberto: abertas.length,
      atrasado: atrasadas.reduce((s, v) => s + v.amount, 0),
      nAtrasado: atrasadas.length,
      recebido: recebidas.reduce((s, v) => s + (v.received_amount ?? v.amount), 0),
      nRecebido: recebidas.length,
    }
  }, [vencs])

  // Marcos de fluxo de caixa (a receber, em aberto).
  const prazos = useMemo(() => {
    const abertas = vencs.filter((v) => !v.is_received)
    const somaAte = (limite: Date) => {
      const ymd = toYMD(limite)
      const alvo = abertas.filter((v) => v.due_date <= ymd)
      return { total: alvo.reduce((s, v) => s + v.amount, 0), n: alvo.length }
    }
    const d5 = nextNthBusinessDay(5)
    const d20 = nextDayOfMonth(20)
    return { d5, d20, ate5: somaAte(d5), ate20: somaAte(d20) }
  }, [vencs])

  // Previsão por mês: soma a receber (em aberto) que vence em cada mês.
  const porMes = useMemo(() => {
    const m = new Map<string, { total: number; n: number }>()
    for (const v of vencs) {
      if (v.is_received) continue
      const ym = v.due_date.slice(0, 7)
      const cur = m.get(ym) ?? { total: 0, n: 0 }
      cur.total += v.amount
      cur.n += 1
      m.set(ym, cur)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [vencs])

  const filtered = useMemo(() => {
    return vencs.filter((v) => {
      if (filter === 'a_receber') return !v.is_received
      if (filter === 'recebidas') return v.is_received
      if (filter === 'atrasadas') return isOverdue(v)
      return true
    })
  }, [vencs, filter])

  const diaVencs = useMemo(
    () => (selectedDay ? vencs.filter((v) => v.due_date === selectedDay) : []),
    [vencs, selectedDay],
  )

  const filters: { key: Filter; label: string }[] = [
    { key: 'a_receber', label: 'A receber' },
    { key: 'atrasadas', label: 'Atrasadas' },
    { key: 'recebidas', label: 'Recebidas' },
    { key: 'todas', label: 'Todas' },
  ]

  function StatusBadge({ v }: { v: Vencimento }) {
    if (v.is_received)
      return (
        <span className="rounded-md bg-[#EAF6EC] px-2 py-0.5 text-[10.5px] font-semibold text-[#15803d]">
          recebida {v.received_date ? `· ${fmtDay(v.received_date)}` : ''}
        </span>
      )
    if (isOverdue(v))
      return <span className="rounded-md bg-[#FCEBEA] px-2 py-0.5 text-[10.5px] font-semibold text-[#b91c1c]">atrasada</span>
    return <span className="rounded-md bg-[#EFF4FF] px-2 py-0.5 text-[10.5px] font-semibold text-[#2563EB]">a receber</span>
  }

  function Cliente({ v }: { v: Vencimento }) {
    const total = totalByDeal.get(v.deal_id) ?? v.installment_number
    return (
      <div>
        <div className="font-medium text-text">{v.deal_nome ?? '—'}</div>
        <div className="mt-0.5 text-[11.5px] text-muted-2">
          Parcela {v.installment_number}/{total}
        </div>
      </div>
    )
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Vencimentos</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading ? 'Carregando…' : `${stats.nAberto} a receber · ${vencs.length} parcelas`}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex overflow-hidden rounded-[9px] border border-border-2">
          <button
            onClick={() => setViewMode('lista')}
            className={'px-3 py-2 text-[12.5px] font-medium ' + (viewMode === 'lista' ? 'bg-primary text-white' : 'bg-card text-muted')}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendario')}
            className={'border-l border-border-2 px-3 py-2 text-[12.5px] font-medium ' + (viewMode === 'calendario' ? 'bg-primary text-white' : 'bg-card text-muted')}
          >
            Calendário
          </button>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          title="Recarregar"
          className="flex items-center gap-1.5 rounded-[9px] border border-border-2 bg-card px-3 py-2.5 text-[13.5px] font-semibold text-muted shadow-sm hover:bg-[#F3F5F8] disabled:opacity-60"
        >
          <Icon name="refresh" className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar vencimentos: {error}
          </div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <StatCard k="Na praça pra receber" v={brl(stats.aberto)} sub={`${stats.nAberto} parcelas em aberto`} ic="wallet" bg="#EFF4FF" fg="#3B82F6" />
              <StatCard k="Atrasadas" v={brl(stats.atrasado)} sub={`${stats.nAtrasado} parcelas`} ic="alert" bg="#FCEBEA" fg="#EF4444" alert={stats.nAtrasado > 0} />
              <StatCard k="Recebido" v={brl(stats.recebido)} sub={`${stats.nRecebido} parcelas`} ic="check" bg="#EAF6EC" fg="#16A34A" />
            </div>

            {/* Marcos de recebimento */}
            <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <PrazoCard label="A receber até o 5º dia útil" date={fmtDay(toYMD(prazos.d5))} total={prazos.ate5.total} n={prazos.ate5.n} />
              <PrazoCard label="A receber até o dia 20" date={fmtDay(toYMD(prazos.d20))} total={prazos.ate20.total} n={prazos.ate20.n} />
            </div>

            {/* Previsão por mês (em aberto) */}
            {porMes.length > 0 && (
              <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
                  A receber por mês (em aberto)
                </div>
                <div className="flex flex-wrap gap-2">
                  {porMes.map(([ym, info]) => (
                    <div key={ym} className="min-w-[128px] flex-1 rounded-[10px] border border-border bg-[#F9FAFB] px-3 py-2">
                      <div className="text-[11.5px] font-medium capitalize text-muted">{monthLabel(ym)}</div>
                      <div className="mt-0.5 text-[15px] font-bold tracking-tight text-text">{brl(info.total)}</div>
                      <div className="text-[10.5px] text-muted-2">{info.n} parcela{info.n === 1 ? '' : 's'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'lista' ? (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {filters.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={
                        'rounded-full border px-3 py-1.5 text-[12.5px] font-medium ' +
                        (filter === f.key
                          ? 'border-primary bg-primary-weak text-primary'
                          : 'border-border-2 bg-card text-muted hover:bg-[#F3F5F8]')
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-2">
                        <th className="px-4 py-2.5 font-semibold">Cliente</th>
                        <th className="px-4 py-2.5 font-semibold">Valor</th>
                        <th className="px-4 py-2.5 font-semibold">Vencimento</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-muted-2">
                            {loading ? 'Carregando…' : 'Nenhuma parcela nesse filtro.'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((v) => (
                          <tr key={v.id} className="border-b border-border last:border-0 hover:bg-[#F9FAFB]">
                            <td className="px-4 py-3"><Cliente v={v} /></td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold">{brl(v.amount)}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className={isOverdue(v) ? 'font-semibold text-[#b91c1c]' : 'text-muted'}>
                                {fmtDay(v.due_date)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3"><StatusBadge v={v} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <Calendar
                  month={calMonth}
                  items={vencs.map((v) => ({ ymd: v.due_date, valor: v.amount, open: !v.is_received }))}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  onPrev={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  onNext={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  onToday={() => setCalMonth(new Date())}
                />
                <div className="mt-4">
                  {!selectedDay ? (
                    <div className="rounded-xl border border-dashed border-border-2 p-6 text-center text-[13px] text-muted-2">
                      Clique num dia do calendário para ver os vencimentos dele.
                    </div>
                  ) : diaVencs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border-2 p-6 text-center text-[13px] text-muted-2">
                      Nenhuma parcela vence em {fmtDay(selectedDay)}.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card shadow-sm">
                      <div className="border-b border-border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
                        Vencem em {fmtDay(selectedDay)}
                      </div>
                      {diaVencs.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                          <div className="min-w-0 flex-1"><Cliente v={v} /></div>
                          <div className="whitespace-nowrap text-[13px] font-semibold">{brl(v.amount)}</div>
                          <StatusBadge v={v} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function PrazoCard({ label, date, total, n }: { label: string; date: string; total: number; n: number }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[#CFE0F5] bg-primary-weak p-4">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary text-white">
        <Icon name="calendar" className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-[#1e4b8f]">
          {label} <span className="font-semibold">({date})</span>
        </div>
        <div className="mt-0.5 text-[22px] font-bold tracking-tight text-text">{brl(total)}</div>
        <div className="text-[11.5px] text-muted-2">{n} parcela{n === 1 ? '' : 's'} em aberto</div>
      </div>
    </div>
  )
}

function StatCard({
  k, v, sub, ic, bg, fg, alert,
}: {
  k: string; v: string; sub: string; ic: 'wallet' | 'alert' | 'check' | 'clock'; bg: string; fg: string; alert?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{k}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: bg, color: fg }}>
          <Icon name={ic} className="h-[17px] w-[17px]" />
        </span>
      </div>
      <div className="mt-2.5 text-[22px] font-bold tracking-tight" style={alert ? { color: '#EF4444' } : undefined}>
        {v}
      </div>
      <div className="mt-0.5 text-[12px] text-muted-2">{sub}</div>
    </div>
  )
}
