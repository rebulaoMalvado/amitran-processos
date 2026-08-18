import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { ehCemPorCento } from './feriados'

export interface FolhaColaborador {
  nome: string
  funcao: string
  dias: Record<string, string> // 'YYYY-MM-DD' -> sigla
  bege?: number // horas extras do cartão de ponto normal (manual), somam nas HE 50%
}

// Valores da convenção / cálculo.
export const DIARIA_VIAGEM = 100
export const AJUDA_ALIMENTACAO = 32
export const DIVISOR_HORA = 220

// Dias úteis e (domingos+feriados) do mês — base do reflexo de DSR.
export function mesInfo(mes: string): { diasNoMes: number; domFer: number; diasUteis: number } {
  const [y, m] = mes.split('-').map(Number)
  const diasNoMes = new Date(y, m, 0).getDate()
  let domFer = 0
  for (let d = 1; d <= diasNoMes; d++) {
    const dt = new Date(y, m - 1, d)
    const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (dt.getDay() === 0 || ehCemPorCento(ymd)) domFer++
  }
  return { diasNoMes, domFer, diasUteis: diasNoMes - domFer }
}

export interface LinhaFolha {
  he50Horas: number
  he100Horas: number
  he50Reais: number
  he100Reais: number
  reflexoDsr: number
  diaria: number
  ajudaAlim: number
  diasViagem: number
  diasTrabalho: number
  temSalario: boolean
}

// Cálculo completo de uma linha da folha (em R$), usando o salário do cadastro.
export function calcLinha(
  colab: FolhaColaborador,
  salarioBase: number | null,
  mes: string,
): LinhaFolha {
  const ot = calcOvertime(colab)
  const bege = Number(colab.bege ?? 0)
  const diasViagem = ot.contagem.SV + ot.contagem.CV + ot.contagem.V
  const diasTrabalho = ot.diasBeneficio // "X" de seg a sex, sem feriado
  const he50Horas = ot.heNormal + bege
  const he100Horas = ot.he100
  const temSalario = !!salarioBase && salarioBase > 0
  const valorHora = temSalario ? salarioBase! / DIVISOR_HORA : 0
  const he50Reais = he50Horas * valorHora * 1.5
  const he100Reais = he100Horas * valorHora * 2
  const totalHE = he50Reais + he100Reais
  const { diasUteis, domFer } = mesInfo(mes)
  const reflexoDsr = totalHE && diasUteis ? (totalHE / diasUteis) * domFer : 0
  return {
    he50Horas,
    he100Horas,
    he50Reais,
    he100Reais,
    reflexoDsr,
    diaria: diasViagem * DIARIA_VIAGEM,
    ajudaAlim: diasTrabalho * AJUDA_ALIMENTACAO,
    diasViagem,
    diasTrabalho,
    temSalario,
  }
}

export interface FolhaMes {
  mes: string // 'YYYY-MM'
  colaboradores: FolhaColaborador[]
}

// Siglas com hora extra (2h/dia; 100% se domingo/feriado).
const OT_CODES = new Set(['SV', 'CV', 'V'])
export const SIGLAS = ['SV', 'CV', 'V', 'X', 'FE', 'FO', 'AT'] as const

// dd/mm/yyyy ou yyyy-mm-dd -> yyyy-mm-dd
function parseDate(v: unknown): string {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return ''
}

// Lê o arquivo xlsx e devolve um FolhaMes por aba que tenha o layout esperado.
export function parseWorkbook(buf: ArrayBuffer): FolhaMes[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const out: FolhaMes[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

    // Acha a linha de cabeçalho (que contém "Data").
    let hr = -1
    let dataCol = -1
    for (let i = 0; i < rows.length; i++) {
      const j = rows[i].findIndex((c) => String(c).trim().toLowerCase() === 'data')
      if (j >= 0) {
        hr = i
        dataCol = j
        break
      }
    }
    if (hr < 0) continue

    const nameRow = rows[hr]
    const funcRow = hr > 0 ? rows[hr - 1] : []
    const emps: { nome: string; funcao: string; col: number }[] = []
    for (let c = dataCol + 1; c < nameRow.length; c++) {
      const nm = String(nameRow[c] ?? '').trim()
      if (nm) emps.push({ nome: nm, funcao: String(funcRow[c] ?? '').trim(), col: c })
    }
    if (!emps.length) continue

    const colaboradores: FolhaColaborador[] = emps.map((e) => ({
      nome: e.nome,
      funcao: e.funcao,
      dias: {},
    }))

    let mes = ''
    for (let i = hr + 1; i < rows.length; i++) {
      const ymd = parseDate(rows[i][dataCol])
      if (!ymd) continue
      if (!mes) mes = ymd.slice(0, 7)
      for (let k = 0; k < emps.length; k++) {
        const code = String(rows[i][emps[k].col] ?? '').trim().toUpperCase()
        if (code) colaboradores[k].dias[ymd] = code
      }
    }
    if (mes) out.push({ mes, colaboradores })
  }
  return out
}

export interface Overtime {
  heNormal: number // horas extras normais (2h/dia útil)
  he100: number // horas extras 100% (domingo/feriado)
  contagem: Record<string, number>
  diasBeneficio: number // "X" de seg a sex, sem feriado (base de VT/VR)
}

export function calcOvertime(colab: FolhaColaborador): Overtime {
  let heNormal = 0
  let he100 = 0
  let diasBeneficio = 0
  const contagem: Record<string, number> = { SV: 0, CV: 0, V: 0, X: 0, FE: 0, FO: 0, AT: 0 }
  for (const [ymd, codeRaw] of Object.entries(colab.dias)) {
    const code = codeRaw.toUpperCase()
    if (code in contagem) contagem[code]++
    const dow = new Date(ymd + 'T00:00:00').getDay() // 0=dom .. 6=sáb
    // VT/VR: dia normal de trabalho (X), seg a sex, sem viagem e sem feriado.
    // ehCemPorCento cobre domingo+feriado; como dow já exclui domingo, aqui exclui feriado.
    if (code === 'X' && dow >= 1 && dow <= 5 && !ehCemPorCento(ymd)) diasBeneficio++
    if (OT_CODES.has(code)) {
      // Viagem: domingo/feriado paga 8h a 100%; seg-sáb, 2h (50%).
      if (ehCemPorCento(ymd)) he100 += 8
      else heNormal += 2
    }
  }
  return { heNormal, he100, contagem, diasBeneficio }
}

// ---- API ----
export async function fetchFolhas(): Promise<FolhaMes[]> {
  const { data, error } = await supabase
    .from('folha_pagamento')
    .select('mes, dados')
    .order('mes', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: { mes: string; dados: { colaboradores?: FolhaColaborador[] } }) => ({
    mes: r.mes,
    colaboradores: r.dados?.colaboradores ?? [],
  }))
}

export async function upsertFolha(
  mes: string,
  colaboradores: FolhaColaborador[],
  userId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('folha_pagamento')
    .upsert(
      { mes, dados: { colaboradores }, created_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'mes' },
    )
  if (error) throw error
}
