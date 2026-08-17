import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { brl, fmtDay } from '../lib/format'
import { parseOfx } from '../lib/ofx'
import { fetchContas } from '../lib/contas'
import { bestContaMatch } from '../lib/match'
import {
  conciliar,
  deleteTransacao,
  desconciliar,
  fetchExtrato,
  importarTransacoes,
  setConferido,
} from '../lib/extrato'
import type { ContaPagar, ExtratoTransacao } from '../lib/types'
import { Icon } from './Icon'
import { useToast } from './Toast'

const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MES_ABREV[Number(m) - 1]}/${y}`
}

export function ExtratoView() {
  const { session } = useAuth()
  const toast = useToast()
  const uid = session?.user.id ?? null
  const fileRef = useRef<HTMLInputElement>(null)

  const [txs, setTxs] = useState<ExtratoTransacao[]>([])
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mes, setMes] = useState<string>('')
  const [soNaoConf, setSoNaoConf] = useState(false)

  function reload() {
    setLoading(true)
    Promise.all([fetchExtrato(), fetchContas()])
      .then(([t, c]) => {
        setTxs(t)
        setContas(c)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  const meses = useMemo(() => {
    const s = new Set<string>()
    for (const t of txs) s.add(t.data.slice(0, 7))
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [txs])
  useEffect(() => {
    if (meses.length && !meses.includes(mes)) setMes(meses[0])
  }, [meses, mes])

  const contaById = useMemo(() => {
    const m = new Map<string, ContaPagar>()
    for (const c of contas) m.set(c.id, c)
    return m
  }, [contas])

  // Contas já ligadas a alguma transação (não sugerir de novo).
  const linkedContaIds = useMemo(() => {
    const s = new Set<string>()
    for (const t of txs) if (t.conta_id) s.add(t.conta_id)
    return s
  }, [txs])

  const contasDisponiveis = useMemo(
    () =>
      contas.filter(
        (c) => (c.status === 'aberta' || c.status === 'pendente') && !linkedContaIds.has(c.id),
      ),
    [contas, linkedContaIds],
  )

  const doMes = useMemo(() => txs.filter((t) => t.data.slice(0, 7) === mes), [txs, mes])

  const resumo = useMemo(() => {
    const entradas = doMes.filter((t) => t.valor > 0).reduce((s, t) => s + Number(t.valor), 0)
    const saidas = doMes.filter((t) => t.valor < 0).reduce((s, t) => s + Number(t.valor), 0)
    const conferidas = doMes.filter((t) => t.conferido).length
    return { entradas, saidas, saldo: entradas + saidas, conferidas, n: doMes.length }
  }, [doMes])

  const lista = useMemo(
    () => (soNaoConf ? doMes.filter((t) => !t.conferido) : doMes),
    [doMes, soNaoConf],
  )

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const text = await file.text()
        const parsed = parseOfx(text)
        if (!parsed.length) toast('Nenhuma transação encontrada no arquivo OFX.')
        else {
          const novas = await importarTransacoes(parsed, uid)
          toast(`${novas} nova(s) importada(s) · ${parsed.length - novas} já existiam.`)
          reload()
        }
      } catch (err) {
        toast('Não consegui ler esse OFX.')
        console.error(err)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function toggleConf(t: ExtratoTransacao) {
    const novo = !t.conferido
    setTxs((prev) => prev.map((x) => (x.id === t.id ? { ...x, conferido: novo } : x)))
    setConferido(t.id, novo, uid).catch((err) => {
      toast('Erro ao salvar conferência — recarregando.')
      console.error(err)
      reload()
    })
  }

  function remover(t: ExtratoTransacao) {
    if (!confirm('Excluir esta transação do extrato?')) return
    setTxs((prev) => prev.filter((x) => x.id !== t.id))
    deleteTransacao(t.id).catch((err) => {
      toast('Erro ao excluir — recarregando.')
      console.error(err)
      reload()
    })
  }

  async function fazerConciliacao(t: ExtratoTransacao, c: ContaPagar) {
    try {
      await conciliar(t, c, uid)
      toast(`Conciliado com "${c.descricao}" e baixado.`)
      reload()
    } catch (err) {
      toast('Erro ao conciliar.')
      console.error(err)
    }
  }

  async function desfazerConciliacao(t: ExtratoTransacao) {
    try {
      await desconciliar(t, t.conta_id ? contaById.get(t.conta_id) : undefined, uid)
      toast('Conciliação desfeita.')
      reload()
    } catch (err) {
      toast('Erro ao desfazer.')
      console.error(err)
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Extrato</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading ? 'Carregando…' : `${txs.length} transações importadas`}
          </div>
        </div>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept=".ofx,application/x-ofx,text/plain" className="hidden" onChange={onFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-[9px] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          <Icon name="upload" className="h-4 w-4" />
          Importar OFX
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar o extrato: {error}
          </div>
        ) : txs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-2 p-10 text-center text-[13px] text-muted-2">
            {loading
              ? 'Carregando…'
              : 'Nenhuma transação ainda. Clique em “Importar OFX” e selecione o extrato baixado do banco.'}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[12.5px] text-muted">
                <span className="text-muted-2">Mês</span>
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="cursor-pointer bg-transparent font-medium capitalize text-text outline-none"
                >
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
                <input type="checkbox" checked={soNaoConf} onChange={(e) => setSoNaoConf(e.target.checked)} />
                só não conferidas
              </label>
              <div className="ml-auto text-[12px] text-muted-2">
                {resumo.conferidas}/{resumo.n} conferidas no mês
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <StatCard k="Entradas" v={brl(resumo.entradas)} ic="wallet" bg="#EAF6EC" fg="#16A34A" />
              <StatCard k="Saídas" v={brl(Math.abs(resumo.saidas))} ic="wallet" bg="#FCEBEA" fg="#EF4444" />
              <StatCard k="Saldo do mês" v={brl(resumo.saldo)} ic="bank" bg="#EFF4FF" fg="#3B82F6" danger={resumo.saldo < 0} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[820px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-2">
                    <th className="px-4 py-2.5 font-semibold">Data</th>
                    <th className="px-4 py-2.5 font-semibold">Descrição</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                    <th className="px-4 py-2.5 font-semibold">Conciliação</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Conf.</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-muted-2">
                        Nada neste filtro.
                      </td>
                    </tr>
                  ) : (
                    lista.map((t) => {
                      const linked = t.conta_id ? contaById.get(t.conta_id) : undefined
                      const match =
                        !t.conta_id && t.valor < 0 ? bestContaMatch(t, contasDisponiveis) : null
                      return (
                        <tr key={t.id} className="border-b border-border last:border-0 align-top hover:bg-[#F9FAFB]">
                          <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDay(t.data)}</td>
                          <td className="px-4 py-3">{t.descricao || <span className="text-muted-2">—</span>}</td>
                          <td
                            className={
                              'whitespace-nowrap px-4 py-3 text-right font-semibold ' +
                              (t.valor < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]')
                            }
                          >
                            {t.valor < 0 ? '- ' : '+ '}
                            {brl(Math.abs(Number(t.valor)))}
                          </td>
                          <td className="px-4 py-3">
                            {t.conta_id ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-md bg-[#EAF6EC] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#15803d]">
                                  <Icon name="check" className="h-3 w-3" />
                                  {linked?.descricao ?? 'conta'}
                                </span>
                                <button onClick={() => desfazerConciliacao(t)} className="text-[11px] text-muted-2 underline hover:text-muted">
                                  desfazer
                                </button>
                              </div>
                            ) : match ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-[12.5px] font-medium text-text">{match.conta.descricao}</div>
                                  <div className="text-[11px] text-muted-2">
                                    {match.conta.favorecido ? match.conta.favorecido + ' · ' : ''}
                                    vence {fmtDay(match.conta.vencimento)} · {confLabel(match.confianca)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => fazerConciliacao(t, match.conta)}
                                  className="rounded-md border border-[#BBE3C4] bg-[#EAF6EC] px-2 py-1 text-[11.5px] font-semibold text-[#15803d] hover:bg-[#DCF0E1]"
                                >
                                  Conciliar
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11.5px] text-muted-2">{t.valor < 0 ? 'sem correspondência' : '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input type="checkbox" checked={t.conferido} onChange={() => toggleConf(t)} className="h-4 w-4 cursor-pointer" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => remover(t)}
                              title="Excluir"
                              className="grid h-7 w-7 place-items-center rounded-md border border-border-2 bg-card text-muted hover:border-[#F6D3D0] hover:bg-[#FCEBEA] hover:text-[#b91c1c]"
                            >
                              <Icon name="trash" className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function confLabel(c: 'alta' | 'media' | 'baixa'): string {
  return c === 'alta' ? 'confiança alta' : c === 'media' ? 'confiança média' : 'confiança baixa'
}

function StatCard({
  k, v, ic, bg, fg, danger,
}: {
  k: string; v: string; ic: 'wallet' | 'bank'; bg: string; fg: string; danger?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{k}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: bg, color: fg }}>
          <Icon name={ic} className="h-[17px] w-[17px]" />
        </span>
      </div>
      <div className="mt-2.5 text-[24px] font-bold tracking-tight" style={danger ? { color: '#EF4444' } : undefined}>
        {v}
      </div>
    </div>
  )
}
