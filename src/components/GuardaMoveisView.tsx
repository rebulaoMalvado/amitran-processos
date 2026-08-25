import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useGuardaMoveis } from '../hooks/useGuardaMoveis'
import { brl } from '../lib/format'
import {
  STATUS_LABEL,
  mesRefFromDate,
  statusBox,
  statusLocacao,
  type BoxStatus,
  type LocStatus,
} from '../lib/gmStatus'
import type { GmLocacao, GmPagamento } from '../lib/types'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { GmBoxDrawer } from './GmBoxDrawer'

// ---- Layout físico (fonte: planta / protótipo). cor => corredor DEPOIS da coluna.
const TOP: { ids: number[]; cor?: boolean }[] = [
  { ids: [33, 34, 35, 36, 37, 38, 39, 40], cor: true },
  { ids: [32, 31, 30, 29, 28, 27, 26, 25] },
  { ids: [17, 18, 19, 20, 21, 22, 23, 24], cor: true },
  { ids: [16, 15, 14, 13, 12, 11, 10, 9] },
  { ids: [1, 2, 3, 4, 5, 6, 7, 8], cor: true },
]
const BOTTOM: { ids: number[]; cor?: boolean }[] = [
  { ids: [41, 42, 43], cor: true },
  { ids: [44, 45, 46] },
  { ids: [49, 48, 47], cor: true },
  { ids: [50, 51, 52] },
]
const BOTTOM_ROW = [53, 54, 55, 56, 57]
const FACILITIES = [
  'Sala cliente',
  'Banheiro cliente',
  'Banheiro funcionário',
  'B. peças',
  'Refeitório',
  'Centro de Especialização e Treinamentos · Odontologia',
]

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Cores por status (fundo/borda/texto do box).
const INTERNO_STYLE = 'border-[#BAE6F0] bg-[#ECFBFE]'
const INTERNO_DOT = 'bg-[#0891B2]'
const BOX_STYLE: Record<BoxStatus, string> = {
  pago: 'border-[#BBE7C6] bg-[#F0FAF2]',
  vencido: 'border-[#F6C9C4] bg-[#FDECEA]',
  proximo: 'border-[#FBE3A2] bg-[#FEF8E7]',
  aberto: 'border-border-2 bg-card',
  vago: 'border-dashed border-border-2 bg-[repeating-linear-gradient(45deg,#fff,#fff_5px,#F5F8FB_5px,#F5F8FB_10px)]',
}
const DOT_STYLE: Record<BoxStatus, string> = {
  pago: 'bg-[#22C55E]',
  vencido: 'bg-[#EF4444]',
  proximo: 'bg-[#EAB308]',
  aberto: 'bg-[#94A3B8]',
  vago: 'bg-transparent border border-border-2',
}

export function GuardaMoveisView() {
  const { session } = useAuth()
  const toast = useToast()
  const gm = useGuardaMoveis(session?.user.id ?? null, toast)
  const { boxes, locacoes, pagamentos, loading, error } = gm

  const hoje = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  const mesRef = mesRefFromDate(cursor)

  // Índices: locações ativas por box, pagamentos por (locacao,mes).
  const locsByBox = useMemo(() => {
    const m = new Map<number, GmLocacao[]>()
    for (const l of locacoes) {
      if (!l.ativo) continue
      const arr = m.get(l.box_numero) ?? []
      arr.push(l)
      m.set(l.box_numero, arr)
    }
    return m
  }, [locacoes])

  const pagByLocMes = useMemo(() => {
    const m = new Map<string, GmPagamento>()
    for (const p of pagamentos) m.set(p.locacao_id + '|' + p.mes_referencia, p)
    return m
  }, [pagamentos])

  // Status de cada box no mês selecionado.
  const boxStatus = useMemo(() => {
    const m = new Map<number, BoxStatus>()
    for (const b of boxes) {
      if (!b.ativo) {
        m.set(b.numero, 'aberto') // interno: neutro (nunca vago/cobrança)
        continue
      }
      const locs = locsByBox.get(b.numero) ?? []
      const sts: LocStatus[] = locs.map((l) =>
        statusLocacao(l, pagByLocMes.get(l.id + '|' + mesRef), mesRef, hoje),
      )
      m.set(b.numero, statusBox(sts))
    }
    return m
  }, [boxes, locsByBox, pagByLocMes, mesRef, hoje])

  // Boxes de uso interno (ativo=false) — não entram na cobrança/vago.
  const internos = useMemo(
    () => new Set(boxes.filter((b) => !b.ativo).map((b) => b.numero)),
    [boxes],
  )

  // Busca -> conjunto de boxes que casam.
  const hits = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return null
    const s = new Set<number>()
    for (const l of locacoes) {
      if (l.ativo && norm(l.cliente_nome).includes(q)) s.add(l.box_numero)
    }
    return s
  }, [query, locacoes])

  // Stats do mês.
  const stats = useMemo(() => {
    const locavel = boxes.filter((b) => b.ativo)
    const ocupados = locavel.filter((b) => (locsByBox.get(b.numero)?.length ?? 0) > 0)
    let atrasados = 0
    let aReceber = 0
    let recebido = 0
    for (const b of ocupados) {
      for (const l of locsByBox.get(b.numero) ?? []) {
        const pag = pagByLocMes.get(l.id + '|' + mesRef)
        const st = statusLocacao(l, pag, mesRef, hoje)
        if (st === 'vencido') atrasados++
        if (pag?.pago) recebido += Number(pag.valor)
        else aReceber += Number(l.valor_mensal ?? 0)
      }
    }
    return {
      ocupados: ocupados.length,
      locavel: locavel.length,
      vagos: locavel.length - ocupados.length,
      atrasados,
      aReceber,
      recebido,
    }
  }, [boxes, locsByBox, pagByLocMes, mesRef, hoje])

  const selectedBox = selected != null ? boxes.find((b) => b.numero === selected) ?? null : null

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Guarda-móveis · GM</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading
              ? 'Carregando…'
              : `${stats.ocupados} de ${stats.locavel} boxes ocupados · ${stats.vagos} vagos`}
          </div>
        </div>
        <div className="flex-1" />
        <MonthPicker
          label={`${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`}
          onPrev={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          onNext={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          onToday={() => setCursor(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
        />
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2">
            <Icon name="grid" className="h-[15px] w-[15px]" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-[240px] max-w-[60vw] rounded-[10px] border border-border-2 bg-card py-2 pl-9 pr-3 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-8 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar o guarda-móveis: {error}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat k="Ocupados" v={`${stats.ocupados}`} s={`de ${stats.locavel}`} tone="blue" />
              <Stat k="Vagos" v={`${stats.vagos}`} s="livres" tone="slate" />
              <Stat k="Atrasados no mês" v={`${stats.atrasados}`} s="a cobrar" tone="red" />
              <Stat k="Recebido no mês" v={brl(stats.recebido)} s={`a receber ${brl(stats.aReceber)}`} tone="green" />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
              {(['pago', 'proximo', 'vencido', 'aberto', 'vago'] as BoxStatus[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <i className={'h-[11px] w-[11px] rounded-[3px] ' + DOT_STYLE[s]} />
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="min-w-[880px]">
                {/* BLOCO SUPERIOR */}
                <PlanBlock
                  spec={TOP}
                  locsByBox={locsByBox}
                  boxStatus={boxStatus}
                  internos={internos}
                  hits={hits}
                  onOpen={setSelected}
                />

                {/* CORREDOR HORIZONTAL + SALA */}
                <div className="my-2.5 flex h-8 items-center gap-3 rounded-lg bg-[repeating-linear-gradient(45deg,#F8FAFC,#F8FAFC_6px,#EEF2F7_6px,#EEF2F7_12px)] px-3">
                  <span className="rounded-md border border-border bg-card px-2.5 py-[3px] text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-2">
                    Sala
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-2">Corredor</span>
                </div>

                {/* BLOCO INFERIOR com ENTRADA na lateral esquerda */}
                <div className="flex items-stretch gap-2.5">
                  <RoomArea label="Entrada" vertical />
                  <div className="min-w-0 flex-1">
                    <PlanBlock
                      spec={BOTTOM}
                      locsByBox={locsByBox}
                      boxStatus={boxStatus}
                      internos={internos}
                      hits={hits}
                      onOpen={setSelected}
                    />
                    {/* FILEIRA 53..57 */}
                    <div className="mt-2.5 grid grid-cols-5 gap-2.5">
                      {BOTTOM_ROW.map((id) => (
                        <BoxTile
                          key={id}
                          numero={id}
                          locs={locsByBox.get(id) ?? []}
                          status={boxStatus.get(id) ?? 'vago'}
                          interno={internos.has(id)}
                          dim={hits ? !hits.has(id) : false}
                          hit={hits ? hits.has(id) : false}
                          onOpen={setSelected}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* FAIXA DE SALAS/ÁREAS NÃO-LOCÁVEIS */}
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  {FACILITIES.map((f) => (
                    <div
                      key={f}
                      className="flex-1 basis-[150px] rounded-[9px] border border-dashed border-border-2 bg-[#F8FAFC] px-3 py-2.5 text-center text-[11px] tracking-[0.02em] text-muted"
                    >
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[11.5px] text-muted-2">
              Cor do box = pior status entre os clientes no mês selecionado. Clique num box para ver
              e editar clientes, valores e pagamentos.
            </p>
          </>
        )}
      </div>

      {selectedBox && (
        <GmBoxDrawer
          box={selectedBox}
          locs={(locsByBox.get(selectedBox.numero) ?? []).slice()}
          encerradas={locacoes.filter((l) => l.box_numero === selectedBox.numero && !l.ativo)}
          pagamentos={pagamentos}
          mesRef={mesRef}
          mesLabel={`${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`}
          hoje={hoje}
          gm={gm}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}

// ---- Bloco de colunas com corredores ----
function PlanBlock({
  spec,
  locsByBox,
  boxStatus,
  internos,
  hits,
  onOpen,
}: {
  spec: { ids: number[]; cor?: boolean }[]
  locsByBox: Map<number, GmLocacao[]>
  boxStatus: Map<number, BoxStatus>
  internos: Set<number>
  hits: Set<number> | null
  onOpen: (n: number) => void
}) {
  return (
    <div className="flex items-stretch gap-2.5">
      {spec.map((col, i) => (
        <div key={i} className="contents">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {col.ids.map((id) => (
              <BoxTile
                key={id}
                numero={id}
                locs={locsByBox.get(id) ?? []}
                status={boxStatus.get(id) ?? 'vago'}
                interno={internos.has(id)}
                dim={hits ? !hits.has(id) : false}
                hit={hits ? hits.has(id) : false}
                onOpen={onOpen}
              />
            ))}
          </div>
          {col.cor && <Corridor />}
        </div>
      ))}
    </div>
  )
}

function Corridor() {
  return (
    <div className="flex w-6 flex-none items-center justify-center rounded-lg bg-[repeating-linear-gradient(135deg,#F8FAFC,#F8FAFC_6px,#EEF2F7_6px,#EEF2F7_12px)]">
      <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-[0.14em] text-muted-2">
        Corredor
      </span>
    </div>
  )
}

function RoomArea({ label, vertical }: { label: string; vertical?: boolean }) {
  return (
    <div className="flex w-11 flex-none items-center justify-center rounded-lg border border-dashed border-border-2 bg-[#F1F3F7]">
      <span
        className={
          'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-2 ' +
          (vertical ? '[writing-mode:vertical-rl] rotate-180' : '')
        }
      >
        {label}
      </span>
    </div>
  )
}

// ---- Box ----
function BoxTile({
  numero,
  locs,
  status,
  interno,
  dim,
  hit,
  onOpen,
}: {
  numero: number
  locs: GmLocacao[]
  status: BoxStatus
  interno?: boolean
  dim: boolean
  hit: boolean
  onOpen: (n: number) => void
}) {
  const vol = locs.reduce((s, l) => s + Number(l.volume_m3 ?? 0), 0)
  const first = locs[0]?.cliente_nome
  const extra = locs.length > 1 ? `+ ${locs.length - 1}` : ''
  return (
    <button
      onClick={() => onOpen(numero)}
      className={
        'relative flex min-h-[72px] flex-col rounded-[11px] border px-2.5 pb-2 pt-2.5 text-left transition-all hover:-translate-y-px hover:shadow-md ' +
        (interno ? INTERNO_STYLE : BOX_STYLE[status]) +
        (dim ? ' opacity-25' : '') +
        (hit ? ' !border-primary ring-2 ring-primary-weak' : '')
      }
    >
      <span className="absolute right-2 top-1.5 text-[11px] font-bold text-muted-2">#{numero}</span>
      <span
        className={'absolute right-2 bottom-2 h-2 w-2 rounded-full ' + (interno ? INTERNO_DOT : DOT_STYLE[status])}
      />
      {interno ? (
        <span className="text-[12px] font-semibold text-[#0E7490]">Interno · documentos</span>
      ) : locs.length === 0 ? (
        <span className="text-[12px] font-semibold text-muted-2">Vago</span>
      ) : (
        <>
          <span className="pr-6 text-[12.5px] font-semibold leading-tight tracking-tight">
            {first}
            {extra && <span className="ml-1 font-medium text-muted">{extra}</span>}
          </span>
          <span className="mt-auto pt-1.5 text-[11px] text-muted-2">
            {vol ? `${vol} m³` : 'volume n/d'}
            {locs.length > 1 ? ` · ${locs.length} clientes` : ''}
          </span>
        </>
      )}
    </button>
  )
}

function MonthPicker({
  label,
  onPrev,
  onNext,
  onToday,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-[10px] border border-border-2 bg-card p-1">
      <button
        onClick={onPrev}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-2 hover:bg-[#F3F5F8] hover:text-text"
        title="Mês anterior"
      >
        <Icon name="chevron" className="h-4 w-4 rotate-180" />
      </button>
      <button
        onClick={onToday}
        className="min-w-[128px] px-2 text-center text-[13px] font-semibold capitalize"
        title="Voltar para o mês atual"
      >
        {label}
      </button>
      <button
        onClick={onNext}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-2 hover:bg-[#F3F5F8] hover:text-text"
        title="Próximo mês"
      >
        <Icon name="chevron" className="h-4 w-4" />
      </button>
    </div>
  )
}

const TONE: Record<string, { bg: string; fg: string }> = {
  blue: { bg: '#EFF4FF', fg: '#3B82F6' },
  slate: { bg: '#F1F5F9', fg: '#64748B' },
  red: { bg: '#FDECEA', fg: '#EF4444' },
  green: { bg: '#F0FAF2', fg: '#22C55E' },
}
function Stat({ k, v, s, tone }: { k: string; v: string; s: string; tone: keyof typeof TONE }) {
  const t = TONE[tone]
  return (
    <div className="rounded-[13px] border border-border bg-card p-3.5">
      <span className="text-[12px] text-muted">{k}</span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[20px] font-bold tracking-tight" style={{ color: t.fg }}>
          {v}
        </span>
        <span className="text-[11.5px] text-muted-2">{s}</span>
      </div>
    </div>
  )
}
