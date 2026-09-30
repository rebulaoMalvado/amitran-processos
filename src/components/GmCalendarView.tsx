import { useMemo } from 'react'
import { brl } from '../lib/format'
import { mesRef } from '../lib/gmStatus'
import type { GmBox, GmLocacao, GmPagamento } from '../lib/types'

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Estado de uma célula (locação × mês).
type Cell = 'pago' | 'isento' | 'naopago' | 'aberto' | 'futuro' | 'na'

// Uma linha do calendário: um cliente (locação) OU um box vago/interno.
type Row =
  | { kind: 'loc'; box: number; loc: GmLocacao }
  | { kind: 'vago'; box: number; label: string }
  | { kind: 'interno'; box: number; label: string }

function cellState(
  loc: GmLocacao,
  pag: GmPagamento | undefined,
  ano: number,
  mes0: number,
  hoje: Date,
): Cell {
  // Fora do período do contrato → não se aplica.
  const ymThis = ano * 12 + mes0
  if (loc.data_inicio) {
    const [y, m] = loc.data_inicio.split('-').map(Number)
    if (ymThis < y * 12 + (m - 1)) return 'na'
  }
  if (loc.data_fim) {
    const [y, m] = loc.data_fim.split('-').map(Number)
    if (ymThis > y * 12 + (m - 1)) return 'na'
  }
  if (pag?.pago) return 'pago'
  if (pag?.isento) return 'isento'
  const ymNow = hoje.getFullYear() * 12 + hoje.getMonth()
  if (ymThis < ymNow) return 'naopago'
  if (ymThis === ymNow) return 'aberto'
  return 'futuro'
}

// Próximo estado ao clicar: → Pago → Isento → Em aberto → …
function nextStatus(c: Cell): 'pago' | 'isento' | 'aberto' {
  if (c === 'pago') return 'isento'
  if (c === 'isento') return 'aberto'
  return 'pago'
}

const CELL_UI: Record<Cell, { cls: string; glyph: string; title: string }> = {
  pago: { cls: 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#c9f7da]', glyph: '✓', title: 'Pago' },
  isento: { cls: 'bg-[#E2E8F0] text-[#475569] hover:bg-[#d7dee7]', glyph: 'IS', title: 'Isento' },
  naopago: { cls: 'bg-[#FDECEA] text-[#DC2626] hover:bg-[#fbdad6]', glyph: '✗', title: 'Não pago' },
  aberto: { cls: 'bg-[#FEF8E7] text-[#B45309] hover:bg-[#fdf1cf]', glyph: '•', title: 'Em aberto (mês atual)' },
  futuro: { cls: 'text-muted-2 hover:bg-[#F3F5F8]', glyph: '', title: 'A vencer — clique p/ marcar pago' },
  na: { cls: 'text-border-2', glyph: '–', title: 'Fora do período' },
}

export function GmCalendarView({
  boxes,
  locacoes,
  pagamentos,
  ano,
  hoje,
  query,
  onSetStatus,
  onOpenBox,
}: {
  boxes: GmBox[]
  locacoes: GmLocacao[]
  pagamentos: GmPagamento[]
  ano: number
  hoje: Date
  query: string
  onSetStatus: (
    locacaoId: string,
    mesReferencia: string,
    valor: number,
    status: 'pago' | 'isento' | 'aberto',
  ) => void
  onOpenBox: (n: number) => void
}) {
  const pagByLocMes = useMemo(() => {
    const m = new Map<string, GmPagamento>()
    for (const p of pagamentos) m.set(p.locacao_id + '|' + p.mes_referencia, p)
    return m
  }, [pagamentos])

  // Monta as linhas: uma por cliente ativo; boxes sem cliente viram vago/interno.
  const rows = useMemo<Row[]>(() => {
    const locsByBox = new Map<number, GmLocacao[]>()
    for (const l of locacoes) {
      if (!l.ativo) continue
      const arr = locsByBox.get(l.box_numero) ?? []
      arr.push(l)
      locsByBox.set(l.box_numero, arr)
    }
    const out: Row[] = []
    for (const b of [...boxes].sort((a, z) => a.numero - z.numero)) {
      const locs = (locsByBox.get(b.numero) ?? []).sort((a, z) =>
        a.cliente_nome.localeCompare(z.cliente_nome),
      )
      if (!b.ativo) {
        out.push({ kind: 'interno', box: b.numero, label: b.observacao || 'Uso interno' })
      } else if (locs.length === 0) {
        out.push({ kind: 'vago', box: b.numero, label: 'Vazio' })
      } else {
        for (const l of locs) out.push({ kind: 'loc', box: b.numero, loc: l })
      }
    }
    return out
  }, [boxes, locacoes])

  const q = norm(query.trim())
  const visibleRows = q
    ? rows.filter((r) => r.kind === 'loc' && norm(r.loc.cliente_nome).includes(q))
    : rows

  // Resumo do ano.
  const resumo = useMemo(() => {
    let pagos = 0
    let recebido = 0
    let previsto = 0
    for (const r of rows) {
      if (r.kind !== 'loc') continue
      const mensal = Number(r.loc.valor_mensal ?? 0)
      for (let m = 0; m < 12; m++) {
        const pag = pagByLocMes.get(r.loc.id + '|' + mesRef(ano, m))
        const st = cellState(r.loc, pag, ano, m, hoje)
        if (st === 'na' || st === 'isento') continue
        previsto += mensal
        if (st === 'pago') {
          pagos++
          recebido += Number(pag?.valor ?? mensal)
        }
      }
    }
    return { pagos, recebido, previsto }
  }, [rows, pagByLocMes, ano, hoje])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat k="Recebido no ano" v={brl(resumo.recebido)} tone="green" />
        <Stat k="Meses pagos" v={`${resumo.pagos}`} tone="blue" />
        <Stat k="Previsto no ano" v={brl(resumo.previsto)} tone="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
        <Legend cls={CELL_UI.pago.cls} g="✓" label="Pago" />
        <Legend cls={CELL_UI.isento.cls} g="IS" label="Isento" />
        <Legend cls={CELL_UI.naopago.cls} g="✗" label="Não pago" />
        <Legend cls={CELL_UI.aberto.cls} g="•" label="Em aberto (mês atual)" />
        <span className="text-muted-2">Clique numa célula: → Pago → Isento → Em aberto</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-[#F8FAFC] text-left text-[11px] uppercase tracking-[0.04em] text-muted-2">
              <th className="sticky left-0 z-10 bg-[#F8FAFC] px-3 py-2.5 text-center font-semibold">Box</th>
              <th className="px-3 py-2.5 font-semibold">Cliente</th>
              <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
              {MES_ABBR.map((m) => (
                <th key={m} className="px-1 py-2.5 text-center font-semibold">{m}</th>
              ))}
              <th className="px-3 py-2.5 font-semibold">Observação</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <CalRow
                key={r.kind === 'loc' ? r.loc.id : r.kind + r.box + '-' + i}
                row={r}
                ano={ano}
                hoje={hoje}
                pagByLocMes={pagByLocMes}
                onSetStatus={onSetStatus}
                onOpenBox={onOpenBox}
              />
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={16} className="px-3 py-10 text-center text-[13px] text-muted-2">
                  Nenhum cliente encontrado para “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-center text-[11.5px] text-muted-2">
        Calendário {ano} · uma linha por cliente. Célula verde = pago. Clique no número do box para
        abrir o detalhe e o histórico.
      </p>
    </div>
  )
}

function CalRow({
  row,
  ano,
  hoje,
  pagByLocMes,
  onSetStatus,
  onOpenBox,
}: {
  row: Row
  ano: number
  hoje: Date
  pagByLocMes: Map<string, GmPagamento>
  onSetStatus: (
    locacaoId: string,
    mesReferencia: string,
    valor: number,
    status: 'pago' | 'isento' | 'aberto',
  ) => void
  onOpenBox: (n: number) => void
}) {
  const boxCell = (
    <td className="sticky left-0 z-[5] bg-card px-3 py-2 text-center">
      <button
        onClick={() => onOpenBox(row.box)}
        className="font-bold text-muted-2 hover:text-primary"
        title="Abrir box"
      >
        {row.box}
      </button>
    </td>
  )

  if (row.kind !== 'loc') {
    const isInterno = row.kind === 'interno'
    return (
      <tr className="border-b border-border">
        {boxCell}
        <td className="px-3 py-2">
          <span className={'font-medium ' + (isInterno ? 'text-[#0E7490]' : 'text-muted-2')}>
            {isInterno ? 'Interno' : 'Vazio'}
          </span>
        </td>
        <td className="px-3 py-2" />
        {Array.from({ length: 12 }).map((_, m) => (
          <td key={m} className="px-1 py-2 text-center text-border-2">–</td>
        ))}
        <td className="px-3 py-2 text-[11.5px] text-muted-2">{row.kind === 'interno' ? row.label : ''}</td>
      </tr>
    )
  }

  const loc = row.loc
  const valor = Number(loc.valor_mensal ?? 0)
  return (
    <tr className="border-b border-border hover:bg-[#FBFCFE]">
      {boxCell}
      <td className="px-3 py-2">
        <div className="font-semibold leading-tight">{loc.cliente_nome}</div>
        {loc.volume_m3 != null && <div className="text-[11px] text-muted-2">{loc.volume_m3} m³</div>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted">
        {loc.valor_mensal != null ? brl(valor) : '—'}
      </td>
      {Array.from({ length: 12 }).map((_, m) => {
        const ref = mesRef(ano, m)
        const pag = pagByLocMes.get(loc.id + '|' + ref)
        const st = cellState(loc, pag, ano, m, hoje)
        const ui = CELL_UI[st]
        const clickable = st !== 'na'
        return (
          <td key={m} className="p-0.5 text-center">
            <button
              disabled={!clickable}
              onClick={() => clickable && onSetStatus(loc.id, ref, valor, nextStatus(st))}
              title={`${MES_ABBR[m]} ${ano} · ${ui.title}${pag?.valor ? ' · ' + brl(Number(pag.valor)) : ''}`}
              className={
                'grid h-7 w-full min-w-[30px] place-items-center rounded-md text-[11px] font-bold transition-colors ' +
                ui.cls +
                (clickable ? ' cursor-pointer' : ' cursor-default')
              }
            >
              {ui.glyph}
            </button>
          </td>
        )
      })}
      <td className="px-3 py-2 text-[11.5px] text-muted-2">{loc.obs || ''}</td>
    </tr>
  )
}

function Legend({ cls, g, label }: { cls: string; g: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={'grid h-[18px] w-[22px] place-items-center rounded text-[10px] font-bold ' + cls}>{g}</i>
      {label}
    </span>
  )
}

const TONE: Record<string, string> = { green: '#22C55E', blue: '#3B82F6', slate: '#64748B' }
function Stat({ k, v, tone }: { k: string; v: string; tone: keyof typeof TONE }) {
  return (
    <div className="rounded-[13px] border border-border bg-card p-3.5">
      <span className="text-[12px] text-muted">{k}</span>
      <div className="mt-1 text-[20px] font-bold tracking-tight" style={{ color: TONE[tone] }}>
        {v}
      </div>
    </div>
  )
}
