import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { brl } from '../lib/format'
import { normalizeName, nameSimilarity } from '../lib/match'
import { fetchColaboradores } from '../lib/colaboradores'
import {
  calcLinha,
  fetchFolhas,
  mesInfo,
  parseWorkbook,
  upsertFolha,
  type FolhaColaborador,
  type FolhaMes,
} from '../lib/folha'
import type { Colaborador } from '../lib/types'
import { Icon } from './Icon'
import { useToast } from './Toast'

const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MES_ABREV[Number(m) - 1]}/${y}`
}
const rs = (n: number) => n.toFixed(2).replace('.', ',')

// Casa o nome da folha de ponto com o cadastro (apelido/nome, tolerante).
function matchCadastro(nomeFolha: string, cad: Colaborador[]): Colaborador | null {
  const alvo = normalizeName(nomeFolha)
  let best: Colaborador | null = null
  let bestScore = 0
  for (const c of cad) {
    const ap = normalizeName(c.apelido || '')
    const nm = normalizeName(c.nome)
    let sc = 0
    if (ap && (ap === alvo || ap.startsWith(alvo) || alvo.startsWith(ap))) sc = 1
    else if (nm.startsWith(alvo) || nm.includes(' ' + alvo)) sc = 0.9
    else sc = Math.max(nameSimilarity(nomeFolha, c.apelido || c.nome), nameSimilarity(c.apelido || c.nome, nomeFolha))
    if (sc > bestScore) {
      bestScore = sc
      best = c
    }
  }
  return bestScore >= 0.6 ? best : null
}

export function FolhaView() {
  const { session } = useAuth()
  const toast = useToast()
  const uid = session?.user.id ?? null
  const fileRef = useRef<HTMLInputElement>(null)

  const [folhas, setFolhas] = useState<FolhaMes[]>([])
  const [cadastro, setCadastro] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mes, setMes] = useState<string>('')

  function reload() {
    setLoading(true)
    Promise.all([fetchFolhas(), fetchColaboradores()])
      .then(([f, c]) => {
        setFolhas(f)
        setCadastro(c)
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
    return atual.colaboradores.map((colab) => {
      const cad = matchCadastro(colab.nome, cadastro)
      const linha = calcLinha(colab, cad ? Number(cad.salario_base) : null, atual.mes)
      return { colab, cad, linha }
    })
  }, [atual, cadastro])

  const totais = useMemo(() => {
    const acc = { he50: 0, he100: 0, dsr: 0, diaria: 0, alim: 0 }
    for (const l of linhas) {
      acc.he50 += l.linha.he50Reais
      acc.he100 += l.linha.he100Reais
      acc.dsr += l.linha.reflexoDsr
      acc.diaria += l.linha.diaria
      acc.alim += l.linha.ajudaAlim
    }
    return acc
  }, [linhas])

  const info = useMemo(() => (atual ? mesInfo(atual.mes) : null), [atual])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const buf = await file.arrayBuffer()
        const ms = parseWorkbook(buf)
        if (!ms.length) toast('Não encontrei o layout esperado na planilha.')
        else {
          for (const fm of ms) await upsertFolha(fm.mes, fm.colaboradores, uid)
          toast(`${ms.length} mês(es) importado(s): ${ms.map((m) => monthLabel(m.mes)).join(', ')}.`)
          reload()
        }
      } catch (err) {
        toast('Não consegui ler essa planilha.')
        console.error(err)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // Edita as HE bege de um colaborador e persiste na folha do mês.
  async function setBege(nome: string, horas: number) {
    if (!atual) return
    const novos: FolhaColaborador[] = atual.colaboradores.map((c) =>
      c.nome === nome ? { ...c, bege: horas } : c,
    )
    setFolhas((prev) => prev.map((f) => (f.mes === atual.mes ? { ...f, colaboradores: novos } : f)))
    try {
      await upsertFolha(atual.mes, novos, uid)
    } catch (err) {
      toast('Erro ao salvar as HE bege.')
      console.error(err)
      reload()
    }
  }

  function exportarCSV() {
    if (!atual) return
    const head = [
      'Codigo', 'Colaborador', 'Funcao', 'HE50 h', 'HE50 R$', 'HE100 h', 'HE100 R$',
      'Reflexo DSR R$', 'Diaria R$', 'Ajuda alim R$', 'Desc plano saude', 'Desc alimentacao', 'Desc VT',
    ]
    const rows = linhas.map(({ colab, cad, linha }) => [
      cad?.codigo ?? '', cad?.nome ?? colab.nome, cad?.funcao ?? colab.funcao,
      String(linha.he50Horas), rs(linha.he50Reais), String(linha.he100Horas), rs(linha.he100Reais),
      rs(linha.reflexoDsr), rs(linha.diaria), rs(linha.ajudaAlim),
      rs(Number(cad?.plano_saude ?? 0)), rs(Number(cad?.alimentacao ?? 0)), rs(Number(cad?.vale_transporte ?? 0)),
    ])
    const csv = [head, ...rows].map((r) => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `folha_onvio_${atual.mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Folha de Pagamento</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading ? 'Carregando…' : `${folhas.length} mês(es) · valores em R$ pelo salário do cadastro`}
          </div>
        </div>
        <div className="flex-1" />
        {folhas.length > 0 && (
          <button
            onClick={exportarCSV}
            className="flex items-center gap-1.5 rounded-[9px] border border-border-2 bg-card px-3 py-2.5 text-[13.5px] font-semibold text-muted shadow-sm hover:bg-[#F3F5F8]"
          >
            <Icon name="download" className="h-4 w-4" />
            Exportar ONVIO
          </button>
        )}
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
            {loading ? 'Carregando…' : 'Nenhuma folha ainda. Importe a planilha de siglas.'}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[12.5px] text-muted">
                <span className="text-muted-2">Mês</span>
                <select value={mes} onChange={(e) => setMes(e.target.value)} className="cursor-pointer bg-transparent font-medium capitalize text-text outline-none">
                  {meses.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </label>
              {info && (
                <span className="text-[12px] text-muted-2">
                  {info.diasUteis} dias úteis · {info.domFer} domingos/feriados (base do DSR)
                </span>
              )}
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-5">
              <Tot k="HE 50%" v={brl(totais.he50)} />
              <Tot k="HE 100%" v={brl(totais.he100)} />
              <Tot k="Reflexo DSR" v={brl(totais.dsr)} />
              <Tot k="Diárias" v={brl(totais.diaria)} />
              <Tot k="Ajuda alim." v={brl(totais.alim)} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[980px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-border text-[10.5px] uppercase tracking-wide text-muted-2">
                    <th className="px-3 py-2.5 font-semibold">Colaborador</th>
                    <th className="px-3 py-2.5 text-center font-semibold">HE bege (h)</th>
                    <th className="px-3 py-2.5 text-right font-semibold">HE 50%</th>
                    <th className="px-3 py-2.5 text-right font-semibold">HE 100%</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Reflexo DSR</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Diária</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Ajuda alim.</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ colab, cad, linha }) => (
                    <tr key={colab.nome} className="border-b border-border last:border-0 hover:bg-[#F9FAFB]">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{cad?.nome ?? colab.nome}</div>
                        <div className="text-[11px] text-muted-2">
                          {cad ? `${cad.funcao} · ${brl(Number(cad.salario_base))}` : (
                            <span className="text-[#b91c1c]">sem cadastro — vincule em Colaboradores</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          defaultValue={colab.bege ?? 0}
                          onBlur={(e) => {
                            const h = Number(e.target.value) || 0
                            if (h !== (colab.bege ?? 0)) setBege(colab.nome, h)
                          }}
                          className="w-16 rounded-md border border-border-2 bg-card px-2 py-1 text-center text-[12.5px] outline-none focus:border-primary"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <div className="font-semibold">{linha.temSalario ? brl(linha.he50Reais) : '—'}</div>
                        <div className="text-[11px] text-muted-2">{linha.he50Horas}h</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <div className="font-semibold text-[#92610a]">{linha.temSalario ? brl(linha.he100Reais) : '—'}</div>
                        <div className="text-[11px] text-muted-2">{linha.he100Horas}h</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{linha.temSalario ? brl(linha.reflexoDsr) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{brl(linha.diaria)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{brl(linha.ajudaAlim)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1 text-[11.5px] text-muted-2">
              <div>• <b>HE 50%</b> = (2h × dia útil de viagem + HE bege) × (salário÷220) × 1,5. <b>HE 100%</b> = 8h × domingo/feriado de viagem × (salário÷220) × 2.</div>
              <div>• <b>Reflexo DSR</b> = (total de HE ÷ dias úteis) × (domingos+feriados) — validado no holerite (Natanael: R$ 167,70). </div>
              <div>• <b>Ajuda alim. (VR)</b> = R$32 × dias "X" de <b>segunda a sexta, sem viagem e sem feriado</b>. <b>Diária</b> = R$100 × dias de viagem. Valores da convenção — confira com o contador e a gente calibra.</div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function Tot({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="text-[11.5px] font-medium text-muted">{k}</div>
      <div className="mt-1 text-[19px] font-bold tracking-tight">{v}</div>
    </div>
  )
}
