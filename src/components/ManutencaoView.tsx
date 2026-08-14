import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { brl, fmtDay } from '../lib/format'
import { addDays, toYMD } from '../lib/prazos'

const GARANTIA_DIAS = 90
import { useFrota, type CaminhaoForm, type ManutencaoForm } from '../hooks/useFrota'
import type { Caminhao } from '../lib/types'
import { Icon } from './Icon'
import { useToast } from './Toast'

const inputCls =
  'w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak'

export function ManutencaoView() {
  const { session } = useAuth()
  const toast = useToast()
  const frota = useFrota(session?.user.id ?? null, toast)
  const { caminhoes, manutencoes, loading, error } = frota

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; caminhao: Caminhao | null }>({
    open: false,
    caminhao: null,
  })

  // Agregados por caminhão.
  const resumo = useMemo(() => {
    const m = new Map<string, { count: number; total: number; last: string | null }>()
    for (const mn of manutencoes) {
      const cur = m.get(mn.caminhao_id) ?? { count: 0, total: 0, last: null }
      cur.count += 1
      cur.total += Number(mn.valor)
      if (!cur.last || mn.data > cur.last) cur.last = mn.data
      m.set(mn.caminhao_id, cur)
    }
    return m
  }, [manutencoes])

  const totalGasto = useMemo(() => manutencoes.reduce((s, m) => s + Number(m.valor), 0), [manutencoes])
  const gastoMes = useMemo(() => {
    const ym = toYMD(new Date()).slice(0, 7)
    return manutencoes.filter((m) => m.data.slice(0, 7) === ym).reduce((s, m) => s + Number(m.valor), 0)
  }, [manutencoes])

  const selected = caminhoes.find((c) => c.id === selectedId) ?? null

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Manutenção</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading ? 'Carregando…' : `${caminhoes.length} caminhões · ${manutencoes.length} manutenções`}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setForm({ open: true, caminhao: null })}
          className="flex items-center gap-1.5 rounded-[9px] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          <Icon name="plus" className="h-4 w-4 [stroke-width:2.4]" />
          Novo caminhão
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar a frota: {error}
          </div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <StatCard k="Caminhões" v={String(caminhoes.length)} ic="truck" bg="#EEF0FE" fg="#6366F1" />
              <StatCard k="Total em manutenção" v={brl(totalGasto)} ic="wrench" bg="#FEF6E3" fg="#CA8A04" />
              <StatCard k="Gasto no mês" v={brl(gastoMes)} ic="wallet" bg="#EFF4FF" fg="#3B82F6" />
            </div>

            {caminhoes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-2 p-10 text-center text-[13px] text-muted-2">
                {loading ? 'Carregando…' : 'Nenhum caminhão cadastrado. Clique em “Novo caminhão” para começar.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {caminhoes.map((c) => {
                  const r = resumo.get(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-[#EEF0FE] text-[#6366F1]">
                          <Icon name="truck" className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-bold tracking-tight">
                            {c.placa}
                          </div>
                          <div className="truncate text-[12px] text-muted-2">
                            {[c.apelido, c.modelo].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[12.5px]">
                        <span className="text-muted">
                          {r?.count ?? 0} manut. · última {r?.last ? fmtDay(r.last) : '—'}
                        </span>
                        <span className="font-semibold">{brl(r?.total ?? 0)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <CaminhaoDrawer
          caminhao={selected}
          frota={frota}
          onClose={() => setSelectedId(null)}
          onEdit={() => setForm({ open: true, caminhao: selected })}
        />
      )}
      {form.open && (
        <CaminhaoFormDrawer
          caminhao={form.caminhao}
          onClose={() => setForm({ open: false, caminhao: null })}
          onSubmit={(f) => {
            if (form.caminhao) frota.editCaminhao(form.caminhao.id, f)
            else frota.addCaminhao(f)
            setForm({ open: false, caminhao: null })
          }}
        />
      )}
    </main>
  )
}

function CaminhaoDrawer({
  caminhao,
  frota,
  onClose,
  onEdit,
}: {
  caminhao: Caminhao
  frota: ReturnType<typeof useFrota>
  onClose: () => void
  onEdit: () => void
}) {
  const lista = frota.manutencoes
    .filter((m) => m.caminhao_id === caminhao.id)
    .sort((a, b) => b.data.localeCompare(a.data))
  const total = lista.reduce((s, m) => s + Number(m.valor), 0)

  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(toYMD(new Date()))
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function add() {
    const v = Number(String(valor).replace(',', '.'))
    if (!descricao.trim()) return setErro('Descreva a manutenção.')
    if (!data) return setErro('Informe a data.')
    if (isNaN(v) || v < 0) return setErro('Valor inválido.')
    const f: ManutencaoForm = { descricao, data, valor: v, obs }
    frota.addManutencao(caminhao.id, f)
    setDescricao('')
    setValor('')
    setObs('')
    setData(toYMD(new Date()))
    setErro(null)
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]" />
      <aside className="fixed right-0 top-0 z-[80] flex h-screen w-[min(500px,96vw)] flex-col border-l border-border bg-card shadow-lg">
        <div className="border-b border-border px-5 pb-4 pt-[18px]">
          <div className="flex items-start gap-2.5">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-[#EEF0FE] text-[#6366F1]">
              <Icon name="truck" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[20px] font-bold tracking-tight">{caminhao.placa}</div>
              <div className="text-[12.5px] text-muted-2">
                {[caminhao.apelido, caminhao.modelo, caminhao.ano].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <button onClick={onEdit} title="Editar caminhão" className="grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]">
                <Icon name="edit" className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Excluir o caminhão ${caminhao.placa} e todas as manutenções? Não pode ser desfeito.`)) {
                    frota.removeCaminhao(caminhao.id)
                    onClose()
                  }
                }}
                title="Excluir caminhão"
                className="grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:border-[#F6D3D0] hover:bg-[#FCEBEA] hover:text-[#b91c1c]"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
            <Icon name="wrench" className="h-4 w-4 text-muted-2" />
            {lista.length} manutenções · total <b className="font-semibold text-text">{brl(total)}</b>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Nova manutenção */}
          <div className="rounded-xl border border-border bg-[#F7F8FA] p-3.5">
            <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
              Lançar manutenção
            </div>
            <div className="mb-2.5">
              <input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Troca de óleo e filtros" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
              <input className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="Valor (R$)" />
            </div>
            <input className={inputCls + ' mt-2.5'} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional) — oficina, nota, etc." />
            {erro && <div className="mt-2 text-[12px] font-medium text-[#b91c1c]">{erro}</div>}
            <button onClick={add} className="mt-3 w-full rounded-[9px] bg-primary py-2.5 text-[13.5px] font-semibold text-white hover:bg-primary-hover">
              Adicionar manutenção
            </button>
          </div>

          {/* Histórico */}
          <div className="mb-2.5 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
            Histórico
          </div>
          {lista.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-2 p-6 text-center text-[13px] text-muted-2">
              Nenhuma manutenção lançada ainda.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lista.map((m) => {
                const garantiaAte = addDays(m.data, GARANTIA_DIAS)
                const naGarantia = garantiaAte >= toYMD(new Date())
                return (
                <div key={m.id} className="flex items-start gap-3 rounded-[10px] border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">{m.descricao}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted-2">
                      {fmtDay(m.data)}
                      {m.obs ? ` · ${m.obs}` : ''}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ' +
                          (naGarantia ? 'bg-[#EAF6EC] text-[#15803d]' : 'bg-[#F1F3F6] text-muted')
                        }
                      >
                        <Icon name={naGarantia ? 'check' : 'clock'} className="h-3 w-3" />
                        {naGarantia ? 'Na garantia' : 'Garantia vencida'}
                      </span>
                      <span className="text-[11px] text-muted-2">até {fmtDay(garantiaAte)} (90 dias)</span>
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-[13.5px] font-semibold">{brl(Number(m.valor))}</div>
                  <button
                    onClick={() => {
                      if (confirm('Excluir esta manutenção?')) frota.removeManutencao(m.id)
                    }}
                    title="Excluir"
                    className="grid h-6 w-6 flex-none place-items-center rounded-md border border-border-2 bg-card text-muted hover:border-[#F6D3D0] hover:bg-[#FCEBEA] hover:text-[#b91c1c]"
                  >
                    <Icon name="trash" className="h-3 w-3" />
                  </button>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

function CaminhaoFormDrawer({
  caminhao,
  onClose,
  onSubmit,
}: {
  caminhao: Caminhao | null
  onClose: () => void
  onSubmit: (f: CaminhaoForm) => void
}) {
  const [placa, setPlaca] = useState(caminhao?.placa ?? '')
  const [modelo, setModelo] = useState(caminhao?.modelo ?? '')
  const [apelido, setApelido] = useState(caminhao?.apelido ?? '')
  const [ano, setAno] = useState(caminhao?.ano ? String(caminhao.ano) : '')
  const [erro, setErro] = useState<string | null>(null)

  function submit() {
    if (!placa.trim()) return setErro('Informe a placa.')
    onSubmit({ placa, modelo, apelido, ano })
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[85] bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]" />
      <aside className="fixed right-0 top-0 z-[90] flex h-screen w-[min(420px,96vw)] flex-col border-l border-border bg-card shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="text-[17px] font-bold tracking-tight">{caminhao ? 'Editar caminhão' : 'Novo caminhão'}</div>
          <button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Field label="Placa *">
            <input className={inputCls} value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC-1D23" autoFocus />
          </Field>
          <Field label="Modelo">
            <input className={inputCls} value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Mercedes Accelo 1016" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Apelido">
              <input className={inputCls} value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Baú 01" />
            </Field>
            <Field label="Ano">
              <input className={inputCls} value={ano} onChange={(e) => setAno(e.target.value)} inputMode="numeric" placeholder="2020" />
            </Field>
          </div>
          {erro && <div className="mt-1 text-[12.5px] font-medium text-[#b91c1c]">{erro}</div>}
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-3.5">
          <button onClick={onClose} className="flex-1 rounded-[9px] border border-border-2 bg-card py-2.5 text-[13.5px] font-semibold text-muted hover:bg-[#F3F5F8]">
            Cancelar
          </button>
          <button onClick={submit} className="flex-1 rounded-[9px] bg-primary py-2.5 text-[13.5px] font-semibold text-white hover:bg-primary-hover">
            {caminhao ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </aside>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-[12.5px] text-muted">{label}</div>
      {children}
    </div>
  )
}

function StatCard({ k, v, ic, bg, fg }: { k: string; v: string; ic: 'truck' | 'wrench' | 'wallet'; bg: string; fg: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{k}</span>
        <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: bg, color: fg }}>
          <Icon name={ic} className="h-[17px] w-[17px]" />
        </span>
      </div>
      <div className="mt-2.5 text-[24px] font-bold tracking-tight">{v}</div>
    </div>
  )
}
