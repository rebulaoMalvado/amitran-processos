import { useEffect, useMemo, useState } from 'react'
import { fetchClaudeUpdates, fetchProfiles, loadBoard } from '../lib/api'
import { fetchContas } from '../lib/contas'
import { fetchVencimentos } from '../lib/vencimentos'
import { ABAS } from '../lib/board'
import { avatarColor, brl, fmtStamp, initial } from '../lib/format'
import { toYMD } from '../lib/prazos'
import type {
  BoardItem,
  ClaudeUpdate,
  ContaPagar,
  Profile,
} from '../lib/types'
import type { Vencimento } from '../lib/vencimentos'
import { Calendar } from './Calendar'
import { Icon } from './Icon'
import type { AppView } from './Sidebar'

interface Activity {
  who: string
  txt: string
  at: string
  ctx: string
  kind: 'processo' | 'conta'
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function MuralView({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [items, setItems] = useState<BoardItem[]>([])
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [vencs, setVencs] = useState<Vencimento[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [updates, setUpdates] = useState<ClaudeUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [varMonth, setVarMonth] = useState(() => new Date())
  const [selVarDay, setSelVarDay] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)

  function reload() {
    setLoading(true)
    Promise.all([
      loadBoard(),
      fetchContas(),
      fetchVencimentos(),
      fetchProfiles(),
      fetchClaudeUpdates(),
    ])
      .then(([b, c, v, profs, u]) => {
        setItems(b)
        setContas(c)
        setVencs(v)
        const map: Record<string, Profile> = {}
        for (const p of profs) map[p.id] = p
        setProfiles(map)
        setUpdates(u)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  const today = toYMD(new Date())

  const alerts = useMemo(() => {
    const pendentes = contas.filter((c) => c.status === 'pendente')
    const contasVencidas = contas.filter((c) => c.status === 'aberta' && c.vencimento < today)
    const recebAtrasados = vencs.filter((v) => !v.is_received && v.due_date < today)
    const parados = items
      .filter((i) => i.processo.status !== 'recebido' && daysSince(i.processo.updated_at) >= 5)
      .sort((a, b) => daysSince(b.processo.updated_at) - daysSince(a.processo.updated_at))
    return { pendentes, contasVencidas, recebAtrasados, parados }
  }, [contas, vencs, items, today])

  const atividade = useMemo<Activity[]>(() => {
    const out: Activity[] = []
    for (const i of items)
      for (const l of i.processo.log)
        out.push({ who: l.who, txt: l.txt, at: l.at, ctx: i.deal.nome, kind: 'processo' })
    for (const c of contas)
      for (const l of c.log)
        out.push({ who: l.who, txt: l.txt, at: l.at, ctx: c.descricao, kind: 'conta' })
    return out
      .filter((a) => a.at && !isNaN(new Date(a.at).getTime()))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 40)
  }, [items, contas])

  const sum = (arr: { valor?: number; amount?: number }[], key: 'valor' | 'amount') =>
    arr.reduce((s, x) => s + Number((x as Record<string, number>)[key] ?? 0), 0)

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Novidades da Vic</div>
          <div className="mt-px text-[12.5px] text-muted">
            O que precisa de atenção e o que o time fez
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={reload}
          disabled={loading}
          title="Recarregar"
          className="flex items-center gap-1.5 rounded-[9px] border border-border-2 bg-card px-3 py-2.5 text-[13.5px] font-semibold text-muted shadow-sm hover:bg-[#F3F5F8] disabled:opacity-60"
        >
          <Icon name="refresh" className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-8 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar o mural: {error}
          </div>
        ) : (
          <>
            {/* Alertas */}
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              <AlertCard
                n={alerts.pendentes.length}
                label="Pendentes de revisão"
                sub={brl(sum(alerts.pendentes, 'valor'))}
                ic="file"
                tone={alerts.pendentes.length > 0 ? 'amber' : 'ok'}
                onClick={() => onNavigate('contas')}
              />
              <AlertCard
                n={alerts.contasVencidas.length}
                label="Contas vencidas"
                sub={brl(sum(alerts.contasVencidas, 'valor'))}
                ic="alert"
                tone={alerts.contasVencidas.length > 0 ? 'red' : 'ok'}
                onClick={() => onNavigate('contas')}
              />
              <AlertCard
                n={alerts.recebAtrasados.length}
                label="Recebíveis atrasados"
                sub={brl(sum(alerts.recebAtrasados, 'amount'))}
                ic="wallet"
                tone={alerts.recebAtrasados.length > 0 ? 'red' : 'ok'}
                onClick={() => onNavigate('vencimentos')}
              />
              <AlertCard
                n={alerts.parados.length}
                label="Processos parados (+5 dias)"
                sub="sem movimento"
                ic="clock"
                tone={alerts.parados.length > 0 ? 'amber' : 'ok'}
                onClick={() => onNavigate('processos')}
              />
            </div>

            {/* Precisa de atenção — detalhe */}
            {(alerts.parados.length > 0 || alerts.contasVencidas.length > 0) && (
              <section>
                <SectionTitle icon="alert" text="Precisa de atenção" />
                <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                  {alerts.parados.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
                        Processos parados
                      </div>
                      <div className="flex flex-col">
                        {alerts.parados.slice(0, 6).map((i) => (
                          <button
                            key={i.processo.id}
                            onClick={() => onNavigate('processos')}
                            className="flex items-center gap-2 border-b border-border py-2 text-left last:border-0 hover:opacity-80"
                          >
                            <span className="h-2 w-2 flex-none rounded-full" style={{ background: ABAS[i.processo.status].color }} />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{i.deal.nome}</span>
                            <span className="text-[11.5px] text-muted-2">{ABAS[i.processo.status].label}</span>
                            <span className="rounded-md bg-[#FEF6E3] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#92610a]">
                              {daysSince(i.processo.updated_at)} dias
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {alerts.contasVencidas.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
                        Contas vencidas
                      </div>
                      <div className="flex flex-col">
                        {alerts.contasVencidas.slice(0, 6).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => onNavigate('contas')}
                            className="flex items-center gap-2 border-b border-border py-2 text-left last:border-0 hover:opacity-80"
                          >
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{c.descricao}</span>
                            <span className="text-[13px] font-semibold">{brl(Number(c.valor))}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Varreduras da Vic */}
            <section>
              <div className="mb-2.5 flex items-center gap-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                  <Icon name="file" className="h-4 w-4 text-muted-2" />
                  Varreduras da Vic
                </div>
                {updates.length > 0 && (
                  <button
                    onClick={() => {
                      if (showCalendar) setSelVarDay(null)
                      setShowCalendar((s) => !s)
                    }}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-border-2 bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-[#F3F5F8]"
                  >
                    <Icon name="calendar" className="h-3.5 w-3.5" />
                    {showCalendar ? 'Ocultar calendário' : 'Calendário'}
                  </button>
                )}
              </div>
              {updates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-2 p-6 text-center text-[13px] text-muted-2">
                  Nenhuma varredura ainda. Quando a rotina de e-mail rodar, os resumos diários
                  aparecem aqui — e ficam guardados no calendário.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {showCalendar && (
                  <Calendar
                    mode="dot"
                    month={varMonth}
                    items={updates.map((u) => ({ ymd: toYMD(new Date(u.created_at)), valor: 1, open: true }))}
                    selectedDay={selVarDay}
                    onSelectDay={setSelVarDay}
                    onPrev={() => setVarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    onNext={() => setVarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    onToday={() => setVarMonth(new Date())}
                  />
                  )}
                  {(selVarDay
                    ? updates.filter((u) => toYMD(new Date(u.created_at)) === selVarDay)
                    : updates
                  ).map((u) => (
                    <div key={u.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Icon name="file" className="h-4 w-4 text-primary" />
                        <span className="text-[14px] font-semibold">{u.titulo}</span>
                        <span className="ml-auto text-[11px] text-muted-2">{fmtStamp(u.created_at)}</span>
                      </div>
                      {u.resumo && <div className="mt-2 text-[13px] leading-relaxed text-muted">{u.resumo}</div>}
                    </div>
                  ))}
                  {selVarDay && updates.filter((u) => toYMD(new Date(u.created_at)) === selVarDay).length === 0 && (
                    <div className="rounded-xl border border-dashed border-border-2 p-5 text-center text-[13px] text-muted-2">
                      Nenhuma varredura em {selVarDay}. <button className="text-primary underline" onClick={() => setSelVarDay(null)}>ver todas</button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Atividade recente */}
            <section>
              <SectionTitle icon="clock" text="Atividade recente" />
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                {loading ? (
                  <div className="py-6 text-center text-[13px] text-muted-2">Carregando…</div>
                ) : atividade.length === 0 ? (
                  <div className="py-6 text-center text-[13px] text-muted-2">Nenhuma ação registrada ainda.</div>
                ) : (
                  <div className="flex flex-col">
                    {atividade.map((a, idx) => {
                      const p = profiles[a.who]
                      return (
                        <div key={idx} className="flex gap-2.5 border-b border-border py-2 last:border-0">
                          <span
                            className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] text-[10px] font-semibold text-white"
                            style={{ background: avatarColor(a.who) }}
                          >
                            {initial(p?.name, '?')}
                          </span>
                          <div className="min-w-0 flex-1 text-[12.5px]">
                            <span className="font-semibold">{p?.name ?? 'Usuário'}</span>{' '}
                            <span className="text-muted">{a.txt}</span>{' '}
                            <span className="inline-flex items-center gap-1 text-muted-2">
                              <Icon name={a.kind === 'conta' ? 'wallet' : 'box'} className="h-3 w-3" />
                              {a.ctx}
                            </span>
                            <div className="mt-px text-[11px] text-muted-2">{fmtStamp(a.at)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function AlertCard({
  n, label, sub, ic, tone, onClick,
}: {
  n: number
  label: string
  sub: string
  ic: 'file' | 'alert' | 'wallet' | 'clock'
  tone: 'amber' | 'red' | 'ok'
  onClick: () => void
}) {
  const palette =
    n === 0
      ? { bg: '#EAF6EC', fg: '#16A34A' }
      : tone === 'red'
        ? { bg: '#FCEBEA', fg: '#EF4444' }
        : { bg: '#FEF6E3', fg: '#CA8A04' }
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: palette.bg, color: palette.fg }}>
          <Icon name={ic} className="h-[17px] w-[17px]" />
        </span>
      </div>
      <div className="mt-2.5 text-[26px] font-bold tracking-tight" style={{ color: n === 0 ? undefined : palette.fg }}>
        {n}
      </div>
      <div className="mt-0.5 text-[12px] text-muted-2">{sub}</div>
    </button>
  )
}

function SectionTitle({ icon, text }: { icon: 'alert' | 'file' | 'clock'; text: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-text">
      <Icon name={icon} className="h-4 w-4 text-muted-2" />
      {text}
    </div>
  )
}
