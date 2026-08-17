import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  calcOvertime,
  fetchFolhas,
  parseWorkbook,
  upsertFolha,
  type FolhaMes,
} from '../lib/folha'
import { Icon } from './Icon'
import { useToast } from './Toast'

const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MES_ABREV[Number(m) - 1]}/${y}`
}

const LEGENDA = [
  ['SV', 'Saiu de viagem — 2h extras/dia (100% dom/feriado)'],
  ['CV', 'Chegou de viagem — 2h extras/dia (100% dom/feriado)'],
  ['V', 'Viajando — 2h extras/dia (100% dom/feriado)'],
  ['X', 'Dia normal — sem hora extra'],
  ['FE', 'Férias'],
  ['FO', 'Folga'],
  ['AT', 'Atestado'],
]

export function FolhaView() {
  const { session } = useAuth()
  const toast = useToast()
  const uid = session?.user.id ?? null
  const fileRef = useRef<HTMLInputElement>(null)

  const [folhas, setFolhas] = useState<FolhaMes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mes, setMes] = useState<string>('')

  function reload() {
    setLoading(true)
    fetchFolhas()
      .then((f) => {
        setFolhas(f)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  const meses = useMemo(() => folhas.map((f) => f.mes), [folhas])
  useEffect(() => {
    if (meses.length && !meses.includes(mes)) setMes(meses[0])
  }, [meses, mes])

  const atual = useMemo(() => folhas.find((f) => f.mes === mes) ?? null, [folhas, mes])

  const linhas = useMemo(() => {
    if (!atual) return []
    return atual.colaboradores.map((c) => ({ colab: c, ot: calcOvertime(c) }))
  }, [atual])

  const totais = useMemo(
    () => ({
      heNormal: linhas.reduce((s, l) => s + l.ot.heNormal, 0),
      he100: linhas.reduce((s, l) => s + l.ot.he100, 0),
    }),
    [linhas],
  )

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const buf = await file.arrayBuffer()
        const meses = parseWorkbook(buf)
        if (!meses.length) {
          toast('Não encontrei o layout esperado (linha "Data" + nomes) na planilha.')
        } else {
          for (const fm of meses) await upsertFolha(fm.mes, fm.colaboradores, uid)
          toast(`${meses.length} mês(es) importado(s): ${meses.map((m) => monthLabel(m.mes)).join(', ')}.`)
          reload()
        }
      } catch (err) {
        toast('Não consegui ler essa planilha.')
        console.error(err)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Folha de Pagamento</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading ? 'Carregando…' : `${folhas.length} mês(es) na base · horas extras automáticas`}
          </div>
        </div>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-[9px] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          <Icon name="upload" className="h-4 w-4" />
          Importar planilha
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar a folha: {error}
          </div>
        ) : folhas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-2 p-10 text-center text-[13px] text-muted-2">
            {loading
              ? 'Carregando…'
              : 'Nenhuma folha ainda. Preencha as siglas na planilha-modelo e clique em “Importar planilha”.'}
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
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-2">
                {LEGENDA.map(([s, d]) => (
                  <span key={s} className="rounded-md border border-border bg-card px-1.5 py-0.5" title={d}>
                    <b className="text-muted">{s}</b>
                  </span>
                ))}
              </div>
            </div>

            {/* Totais do mês */}
            <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <StatCard k="HE normais (mês)" v={`${totais.heNormal} h`} bg="#EFF4FF" fg="#3B82F6" />
              <StatCard k="HE 100% (mês)" v={`${totais.he100} h`} bg="#FEF6E3" fg="#CA8A04" />
              <StatCard k="Colaboradores" v={String(linhas.length)} bg="#EEF0FE" fg="#6366F1" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-2">
                    <th className="px-4 py-2.5 font-semibold">Colaborador</th>
                    <th className="px-4 py-2.5 font-semibold">Função</th>
                    <th className="px-4 py-2.5 text-right font-semibold">HE normais</th>
                    <th className="px-4 py-2.5 text-right font-semibold">HE 100%</th>
                    <th className="px-4 py-2.5 text-center font-semibold" title="Saiu / Chegou / Viajando">Viagem (dias)</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Fé/Fo/At</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ colab, ot }) => {
                    const viagem = ot.contagem.SV + ot.contagem.CV + ot.contagem.V
                    const ausencias = ot.contagem.FE + ot.contagem.FO + ot.contagem.AT
                    return (
                      <tr key={colab.nome} className="border-b border-border last:border-0 hover:bg-[#F9FAFB]">
                        <td className="px-4 py-3 font-medium">{colab.nome}</td>
                        <td className="px-4 py-3 text-muted">{colab.funcao || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{ot.heNormal} h</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#92610a]">{ot.he100} h</td>
                        <td className="px-4 py-3 text-center text-muted">{viagem}</td>
                        <td className="px-4 py-3 text-center text-muted-2">
                          {ausencias > 0
                            ? `${ot.contagem.FE}/${ot.contagem.FO}/${ot.contagem.AT}`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-[11.5px] text-muted-2">
              HE = 2h por dia de viagem (SV/CV/V). Domingos e feriados nacionais contam como
              <b> 100%</b>; demais dias como HE normais. Feriados municipais podem ser adicionados depois.
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function StatCard({ k, v, bg, fg }: { k: string; v: string; bg: string; fg: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{k}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: bg, color: fg }}>
          <Icon name="users" className="h-[17px] w-[17px]" />
        </span>
      </div>
      <div className="mt-2.5 text-[24px] font-bold tracking-tight">{v}</div>
    </div>
  )
}
