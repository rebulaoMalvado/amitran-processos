import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { CATEGORIAS } from '../lib/contas'
import { brl, fmtDay } from '../lib/format'
import {
  abertasAte,
  nextDayOfMonth,
  nextNthBusinessDay,
  toYMD,
} from '../lib/prazos'
import { useContas, type ContaFormData } from '../hooks/useContas'
import type { ContaPagar } from '../lib/types'
import { Calendar } from './Calendar'
import { ContaFormDrawer } from './ContaFormDrawer'
import { Icon } from './Icon'
import { useToast } from './Toast'

type StatusFilter = 'todas' | 'pendentes' | 'abertas' | 'vencidas' | 'pagas'
type ViewMode = 'lista' | 'calendario'

function isOverdue(c: ContaPagar): boolean {
  if (c.status !== 'aberta') return false
  return c.vencimento < toYMD(new Date())
}

export function ContasView() {
  const { session } = useAuth()
  const toast = useToast()
  const contasApi = useContas(session?.user.id ?? null, toast)
  const { contas, deals, loading, error } = contasApi

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('abertas')
  const [viewMode, setViewMode] = useState<ViewMode>('lista')
  const [showResumo, setShowResumo] = useState(false)
  const [calMonth, setCalMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<{ open: boolean; conta: ContaPagar | null }>({
    open: false,
    conta: null,
  })

  const dealName = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of deals) m.set(d.id, d.nome)
    return m
  }, [deals])

  const filtered = useMemo(() => {
    return contas.filter((c) => {
      if (statusFilter === 'pendentes') return c.status === 'pendente'
      if (statusFilter === 'abertas') return c.status === 'aberta'
      if (statusFilter === 'pagas') return c.status === 'paga'
      if (statusFilter === 'vencidas') return isOverdue(c)
      return true
    })
  }, [contas, statusFilter])

  const stats = useMemo(() => {
    const pendentes = contas.filter((c) => c.status === 'pendente')
    const abertas = contas.filter((c) => c.status === 'aberta')
    const totalAberto = abertas.reduce((s, c) => s + Number(c.valor), 0)
    const vencidas = abertas.filter(isOverdue)
    const pagas = contas.filter((c) => c.status === 'paga')
    return {
      totalAberto,
      nAberto: abertas.length,
      nPendente: pendentes.length,
      totalPendente: pendentes.reduce((s, c) => s + Number(c.valor), 0),
      totalVencido: vencidas.reduce((s, c) => s + Number(c.valor), 0),
      nVencido: vencidas.length,
      totalPago: pagas.reduce((s, c) => s + Number(c.valor_pago ?? c.valor), 0),
      nPago: pagas.length,
    }
  }, [contas])

  // Prazos-chave de fluxo de caixa.
  const prazos = useMemo(() => {
    const d5 = nextNthBusinessDay(5)
    const d20 = nextDayOfMonth(20)
    return {
      d5,
      d20,
      ate5: abertasAte(contas, d5),
      ate20: abertasAte(contas, d20),
    }
  }, [contas])

  const diaContas = useMemo(
    () => (selectedDay ? contas.filter((c) => c.vencimento === selectedDay) : []),
    [contas, selectedDay],
  )

  function handleSubmit(form: ContaFormData) {
    if (drawer.conta) contasApi.editConta(drawer.conta.id, form)
    else contasApi.addConta(form)
    setDrawer({ open: false, conta: null })
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'pendentes', label: stats.nPendente > 0 ? `Pendentes (${stats.nPendente})` : 'Pendentes' },
    { key: 'abertas', label: 'Abertas' },
    { key: 'vencidas', label: 'Vencidas' },
    { key: 'pagas', label: 'Pagas' },
    { key: 'todas', label: 'Todas' },
  ]

  function StatusBadge({ c }: { c: ContaPagar }) {
    if (c.status === 'pendente')
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF6E3] px-2 py-0.5 text-[10.5px] font-semibold text-[#92610a]">
          {c.origem === 'email' && <Icon name="file" className="h-3 w-3" />}
          pendente
        </span>
      )
    if (c.status === 'paga')
      return (
        <span className="rounded-md bg-[#EAF6EC] px-2 py-0.5 text-[10.5px] font-semibold text-[#15803d]">
          paga {c.pago_em ? `· ${fmtDay(c.pago_em)}` : ''}
        </span>
      )
    if (isOverdue(c))
      return <span className="rounded-md bg-[#FCEBEA] px-2 py-0.5 text-[10.5px] font-semibold text-[#b91c1c]">vencida</span>
    return <span className="rounded-md bg-[#F1F3F6] px-2 py-0.5 text-[10.5px] font-semibold text-muted">aberta</span>
  }

  function Actions({ c }: { c: ContaPagar }) {
    return (
      <div className="flex items-center justify-end gap-1">
        {c.status === 'pendente' ? (
          <button
            onClick={() => contasApi.confirmConta(c.id)}
            className="rounded-md border border-[#BBE3C4] bg-[#EAF6EC] px-2 py-1 text-[11.5px] font-semibold text-[#15803d] hover:bg-[#DCF0E1]"
          >
            Confirmar
          </button>
        ) : c.status === 'aberta' ? (
          <button
            onClick={() => contasApi.markPaid(c.id, Number(c.valor), c.forma_pagamento ?? '')}
            className="rounded-md border border-[#BBE3C4] bg-[#EAF6EC] px-2 py-1 text-[11.5px] font-semibold text-[#15803d] hover:bg-[#DCF0E1]"
          >
            Marcar paga
          </button>
        ) : (
          <button
            onClick={() => contasApi.reopen(c.id)}
            className="rounded-md border border-border-2 bg-card px-2 py-1 text-[11.5px] font-medium text-muted hover:bg-[#F3F5F8]"
          >
            Reabrir
          </button>
        )}
        <button
          onClick={() => setDrawer({ open: true, conta: c })}
          title="Editar"
          className="grid h-7 w-7 place-items-center rounded-md border border-border-2 bg-card text-muted hover:bg-[#F3F5F8]"
        >
          <Icon name="edit" className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirm(`Excluir "${c.descricao}"? Esta ação não pode ser desfeita.`))
              contasApi.removeConta(c.id)
          }}
          title="Excluir"
          className="grid h-7 w-7 place-items-center rounded-md border border-border-2 bg-card text-muted hover:border-[#F6D3D0] hover:bg-[#FCEBEA] hover:text-[#b91c1c]"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  function Meta({ c }: { c: ContaPagar }) {
    const cat = CATEGORIAS[c.categoria]
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: cat.bg, color: cat.color }}>
          {cat.label}
        </span>
        {c.favorecido && <span className="text-[11.5px] text-muted-2">{c.favorecido}</span>}
        {c.deal_id && dealName.has(c.deal_id) && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-2">
            <Icon name="link" className="h-3 w-3" />
            {dealName.get(c.deal_id)}
          </span>
        )}
      </div>
    )
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Contas a pagar</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading ? 'Carregando…' : `${stats.nAberto} em aberto · ${contas.length} no total`}
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
          onClick={() => setDrawer({ open: true, conta: null })}
          className="flex items-center gap-1.5 rounded-[9px] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          <Icon name="plus" className="h-4 w-4 [stroke-width:2.4]" />
          Nova conta
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar contas: {error}
          </div>
        ) : (
          <>
            {stats.nPendente > 0 && (
              <div className="mb-3.5 flex items-center gap-3 rounded-xl border border-[#F6E0A6] bg-[#FEF6E3] px-4 py-3">
                <Icon name="file" className="h-5 w-5 flex-none text-[#92610a]" />
                <div className="min-w-0 flex-1 text-[13px] text-[#92610a]">
                  <b className="font-semibold">{stats.nPendente} conta(s) aguardando revisão</b> — importadas do
                  e-mail ({brl(stats.totalPendente)}). Confira e confirme.
                </div>
                <button
                  onClick={() => {
                    setViewMode('lista')
                    setStatusFilter('pendentes')
                  }}
                  className="flex-none rounded-lg bg-[#92610a] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#7a5108]"
                >
                  Revisar
                </button>
              </div>
            )}

            {/* Resumo (prazos + status) — recolhível */}
            <button
              onClick={() => setShowResumo((s) => !s)}
              className="mb-3.5 flex w-full items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px] font-medium text-muted hover:bg-[#F3F5F8]"
            >
              <Icon
                name="arrow"
                className={'h-3.5 w-3.5 transition-transform ' + (showResumo ? 'rotate-90' : '')}
              />
              {showResumo ? 'Ocultar resumo' : 'Mostrar resumo'}
              {!showResumo && (
                <span className="ml-auto text-[12px] text-muted-2">
                  A pagar {brl(stats.totalAberto)}
                  {stats.nVencido > 0 ? ` · vencidas ${brl(stats.totalVencido)}` : ''}
                </span>
              )}
            </button>

            {showResumo && (
              <>
                <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <PrazoCard
                    label="A pagar até o 5º dia útil"
                    date={fmtDay(toYMD(prazos.d5))}
                    total={prazos.ate5.total}
                    n={prazos.ate5.n}
                  />
                  <PrazoCard
                    label="A pagar até o dia 20"
                    date={fmtDay(toYMD(prazos.d20))}
                    total={prazos.ate20.total}
                    n={prazos.ate20.n}
                  />
                </div>

                <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <StatCard k="A pagar (em aberto)" v={brl(stats.totalAberto)} sub={`${stats.nAberto} contas`} ic="wallet" bg="#EFF4FF" fg="#3B82F6" />
                  <StatCard k="Vencidas" v={brl(stats.totalVencido)} sub={`${stats.nVencido} contas`} ic="alert" bg="#FCEBEA" fg="#EF4444" alert={stats.nVencido > 0} />
                  <StatCard k="Pagas" v={brl(stats.totalPago)} sub={`${stats.nPago} contas`} ic="check" bg="#EAF6EC" fg="#16A34A" />
                </div>
              </>
            )}

            {viewMode === 'lista' ? (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {filters.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={
                        'rounded-full border px-3 py-1.5 text-[12.5px] font-medium ' +
                        (statusFilter === f.key
                          ? 'border-primary bg-primary-weak text-primary'
                          : 'border-border-2 bg-card text-muted hover:bg-[#F3F5F8]')
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-2">
                        <th className="px-4 py-2.5 font-semibold">Descrição</th>
                        <th className="px-4 py-2.5 font-semibold">Valor</th>
                        <th className="px-4 py-2.5 font-semibold">Vencimento</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-muted-2">
                            {loading ? 'Carregando…' : 'Nenhuma conta nesse filtro.'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((c) => (
                          <tr key={c.id} className="border-b border-border last:border-0 hover:bg-[#F9FAFB]">
                            <td className="px-4 py-3">
                              <div className="font-medium text-text">{c.descricao}</div>
                              <Meta c={c} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold">{brl(Number(c.valor))}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className={isOverdue(c) ? 'font-semibold text-[#b91c1c]' : 'text-muted'}>
                                {fmtDay(c.vencimento)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3"><StatusBadge c={c} /></td>
                            <td className="whitespace-nowrap px-4 py-3 text-right"><Actions c={c} /></td>
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
                  items={contas.map((c) => ({ ymd: c.vencimento, valor: Number(c.valor), open: c.status !== 'paga' }))}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  onPrev={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  onNext={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  onToday={() => setCalMonth(new Date())}
                />
                <div className="mt-4">
                  {!selectedDay ? (
                    <div className="rounded-xl border border-dashed border-border-2 p-6 text-center text-[13px] text-muted-2">
                      Clique num dia do calendário para ver as contas que vencem nele.
                    </div>
                  ) : diaContas.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border-2 p-6 text-center text-[13px] text-muted-2">
                      Nenhuma conta vence em {fmtDay(selectedDay)}.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card shadow-sm">
                      <div className="border-b border-border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
                        Vencem em {fmtDay(selectedDay)}
                      </div>
                      {diaContas.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-text">{c.descricao}</div>
                            <Meta c={c} />
                          </div>
                          <div className="whitespace-nowrap text-[13px] font-semibold">{brl(Number(c.valor))}</div>
                          <StatusBadge c={c} />
                          <Actions c={c} />
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

      {drawer.open && (
        <ContaFormDrawer
          conta={drawer.conta}
          deals={deals}
          onClose={() => setDrawer({ open: false, conta: null })}
          onSubmit={handleSubmit}
        />
      )}
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
        <div className="text-[11.5px] text-muted-2">{n} conta{n === 1 ? '' : 's'} em aberto</div>
      </div>
    </div>
  )
}

function StatCard({
  k, v, sub, ic, bg, fg, alert,
}: {
  k: string; v: string; sub: string; ic: 'wallet' | 'alert' | 'check'; bg: string; fg: string; alert?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{k}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: bg, color: fg }}>
          <Icon name={ic} className="h-[17px] w-[17px]" />
        </span>
      </div>
      <div className="mt-2.5 text-[24px] font-bold tracking-tight" style={alert ? { color: '#EF4444' } : undefined}>
        {v}
      </div>
      <div className="mt-0.5 text-[12px] text-muted-2">{sub}</div>
    </div>
  )
}
