import { useMemo, useState } from 'react'
import { nomeCaminhao } from '../hooks/useProgramacao'
import { fmtDay } from '../lib/format'
import { addDays, toYMD } from '../lib/prazos'
import {
  detectarConflitos,
  localSugerido,
  ROTEIROS,
  TIPOS,
  TIPO_KEYS,
  type NewProgramacao,
} from '../lib/programacao'
import type { Caminhao, Colaborador, DealProg, ProgTipo, Programacao } from '../lib/types'
import { Conflitos, EquipePicker, Field, inputCls } from './ProgramacaoDrawer'
import { Icon } from './Icon'

interface EtapaForm {
  uid: number
  tipo: ProgTipo
  data: string
  local: string
  usaVeiculo: boolean
}

let uidSeq = 0

function diffDias(a: string, b: string): number {
  return Math.round(
    (new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000,
  )
}

// Cria a mudança inteira de uma vez: o Gleison escolhe o cliente, o caminhão, a
// equipe e a data de início; o sistema gera um dia para cada etapa (editáveis).
export function RoteiroDrawer({
  eventos,
  deals,
  caminhoes,
  pessoas,
  labelCaminhao,
  labelPessoa,
  onClose,
  onSave,
}: {
  eventos: Programacao[]
  deals: DealProg[]
  caminhoes: Caminhao[]
  pessoas: Colaborador[]
  labelCaminhao: (id: string) => string
  labelPessoa: (id: string) => string
  onClose: () => void
  onSave: (rows: Omit<NewProgramacao, 'created_by'>[]) => void
}) {
  const [dealId, setDealId] = useState<string | null>(null)
  const [cliente, setCliente] = useState('')
  const [executor, setExecutor] = useState<'frota' | 'terceiro'>('frota')
  const [caminhaoId, setCaminhaoId] = useState<string | null>(null)
  const [equipe, setEquipe] = useState<string[]>([])
  const [inicio, setInicio] = useState(toYMD(new Date()))
  const [roteiroKey, setRoteiroKey] = useState('viagem')
  const [etapas, setEtapas] = useState<EtapaForm[]>(() => gerar('viagem', toYMD(new Date()), null))
  const [erro, setErro] = useState<string | null>(null)

  const deal = deals.find((d) => d.id === dealId) ?? null

  function gerar(key: string, ini: string, d: DealProg | null): EtapaForm[] {
    const r = ROTEIROS.find((x) => x.key === key)
    return (r?.etapas ?? []).map((e) => ({
      uid: ++uidSeq,
      tipo: e.tipo,
      data: addDays(ini, e.offset),
      local: localSugerido(e.tipo, d),
      usaVeiculo: e.tipo !== 'embalagem', // embalagem costuma ser só equipe
    }))
  }

  function trocarRoteiro(key: string) {
    setRoteiroKey(key)
    setEtapas(gerar(key, inicio, deal))
  }

  function trocarInicio(novo: string) {
    if (!novo) return setInicio(novo)
    // Desloca tudo junto, preservando os ajustes manuais de cada dia.
    const delta = inicio ? diffDias(novo, inicio) : 0
    setEtapas((prev) => prev.map((e) => ({ ...e, data: e.data ? addDays(e.data, delta) : e.data })))
    setInicio(novo)
  }

  function escolherDeal(id: string) {
    const d = deals.find((x) => x.id === id) ?? null
    setDealId(d ? d.id : null)
    if (!d) return
    setCliente(d.nome)
    if (d.parceiro?.trim()) setExecutor('terceiro')
    // Só atualiza o local das etapas que ainda estão no valor sugerido (ou vazias).
    setEtapas((prev) =>
      prev.map((e) =>
        !e.local.trim() || e.local === localSugerido(e.tipo, deal) ? { ...e, local: localSugerido(e.tipo, d) } : e,
      ),
    )
  }

  const setEtapa = (uid: number, patch: Partial<EtapaForm>) =>
    setEtapas((prev) => prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e)))

  function novaEtapa() {
    const ultima = etapas[etapas.length - 1]
    setEtapas((prev) => [
      ...prev,
      {
        uid: ++uidSeq,
        tipo: 'outro',
        data: ultima?.data ? addDays(ultima.data, 1) : inicio,
        local: '',
        usaVeiculo: true,
      },
    ])
  }

  function paraLinhas(): Omit<NewProgramacao, 'created_by'>[] {
    return etapas.map((e) => ({
      data: e.data,
      tipo: e.tipo,
      status: 'previsto' as const,
      deal_id: dealId,
      cliente: cliente.trim() || null,
      caminhao_id: e.usaVeiculo && executor === 'frota' ? caminhaoId : null,
      terceiro: e.usaVeiculo && executor === 'terceiro',
      local: e.local.trim() || null,
      equipe,
      obs: null,
    }))
  }

  // Conflitos do que está sendo montado (contra a programação existente).
  const msgs = useMemo(() => {
    const drafts: Programacao[] = etapas
      .filter((e) => e.data)
      .map((e) => ({
        id: '__r' + e.uid,
        data: e.data,
        tipo: e.tipo,
        status: 'previsto',
        deal_id: dealId,
        cliente: cliente.trim() || null,
        caminhao_id: e.usaVeiculo && executor === 'frota' ? caminhaoId : null,
        terceiro: e.usaVeiculo && executor === 'terceiro',
        local: null,
        equipe,
        obs: null,
        created_by: null,
        created_at: '',
        updated_at: '',
      }))
    const m = detectarConflitos([...eventos, ...drafts], labelCaminhao, labelPessoa)
    const out: string[] = []
    for (const d of drafts) for (const msg of m.get(d.id) ?? []) out.push(`${fmtDay(d.data)} · ${msg}`)
    return Array.from(new Set(out))
  }, [etapas, eventos, dealId, cliente, executor, caminhaoId, equipe, labelCaminhao, labelPessoa])

  function submit() {
    if (!cliente.trim()) return setErro('Informe a mudança (cliente).')
    if (etapas.length === 0) return setErro('Adicione pelo menos uma etapa.')
    if (etapas.some((e) => !e.data)) return setErro('Toda etapa precisa de um dia.')
    if (executor === 'frota' && etapas.some((e) => e.usaVeiculo) && !caminhaoId)
      return setErro('Escolha o caminhão (ou marque Terceiro).')
    setErro(null)
    onSave(paraLinhas())
  }

  const segBtn = (on: boolean) =>
    'flex-1 px-2.5 py-2 text-[12.5px] font-medium ' + (on ? 'bg-primary text-white' : 'bg-card text-muted')

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]" />
      <aside className="fixed right-0 top-0 z-[80] flex h-screen w-[min(520px,96vw)] flex-col border-l border-border bg-card shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="text-[17px] font-bold tracking-tight">Programar mudança</div>
          <button
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Field label="Mudança (cliente) *">
            <select className={inputCls} value={dealId ?? ''} onChange={(e) => escolherDeal(e.target.value)}>
              <option value="">— outro / ainda não está no CRM —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                  {d.data_mudanca ? ` · ${fmtDay(d.data_mudanca)}` : ''}
                </option>
              ))}
            </select>
            {!dealId && (
              <input
                className={inputCls + ' mt-2'}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome do cliente"
                autoFocus
              />
            )}
          </Field>

          <Field label="Quem faz o transporte">
            <div className="flex overflow-hidden rounded-[9px] border border-border-2">
              <button type="button" onClick={() => setExecutor('frota')} className={segBtn(executor === 'frota')}>
                Caminhão da frota
              </button>
              <button
                type="button"
                onClick={() => setExecutor('terceiro')}
                className={segBtn(executor === 'terceiro') + ' border-l border-border-2'}
              >
                Terceiro
              </button>
            </div>
            {executor === 'frota' && (
              <select
                className={inputCls + ' mt-2'}
                value={caminhaoId ?? ''}
                onChange={(e) => setCaminhaoId(e.target.value || null)}
              >
                <option value="">— escolha o caminhão —</option>
                {caminhoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nomeCaminhao(c)}
                    {c.modelo ? ` · ${c.modelo}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Equipe (vale para todos os dias — ajuste um dia depois se mudar)">
            <EquipePicker pessoas={pessoas} value={equipe} onChange={setEquipe} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Começa em *">
              <input type="date" className={inputCls} value={inicio} onChange={(e) => trocarInicio(e.target.value)} />
            </Field>
            <Field label="Roteiro">
              <select className={inputCls} value={roteiroKey} onChange={(e) => trocarRoteiro(e.target.value)}>
                {ROTEIROS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mb-1.5 flex items-center">
            <span className="text-[12px] font-semibold text-muted">Etapas (um dia cada — pode ajustar)</span>
          </div>
          <div className="mb-3 flex flex-col gap-2">
            {etapas.map((e) => {
              const t = TIPOS[e.tipo]
              return (
                <div
                  key={e.uid}
                  className="rounded-[10px] border p-2.5"
                  style={{ background: t.bg + '88', borderColor: t.border }}
                >
                  <div className="flex items-center gap-2">
                    <select
                      className={inputCls + ' !w-[130px] !py-1.5'}
                      value={e.tipo}
                      onChange={(ev) => {
                        const novo = ev.target.value as ProgTipo
                        setEtapa(e.uid, {
                          tipo: novo,
                          local: !e.local.trim() || e.local === localSugerido(e.tipo, deal) ? localSugerido(novo, deal) : e.local,
                        })
                      }}
                    >
                      {TIPO_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {TIPOS[k].label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className={inputCls + ' !w-[150px] !py-1.5'}
                      value={e.data}
                      onChange={(ev) => setEtapa(e.uid, { data: ev.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setEtapas((prev) => prev.filter((x) => x.uid !== e.uid))}
                      title="Remover etapa"
                      className="ml-auto grid h-8 w-8 flex-none place-items-center rounded-lg text-muted-2 hover:bg-white hover:text-[#b91c1c]"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className={inputCls + ' !py-1.5'}
                      value={e.local}
                      onChange={(ev) => setEtapa(e.uid, { local: ev.target.value })}
                      placeholder="Local / trajeto"
                    />
                    <label className="flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap text-[12px] text-muted">
                      <input
                        type="checkbox"
                        checked={e.usaVeiculo}
                        onChange={(ev) => setEtapa(e.uid, { usaVeiculo: ev.target.checked })}
                      />
                      usa caminhão
                    </label>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              onClick={novaEtapa}
              className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-2 py-2 text-[12.5px] font-medium text-muted hover:bg-[#F3F5F8]"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              Adicionar etapa
            </button>
          </div>

          <Conflitos msgs={msgs} />
          {erro && (
            <div className="rounded-lg border border-[#F6D3D0] bg-[#FCEBEA] px-3 py-2 text-[12.5px] font-medium text-[#b91c1c]">
              {erro}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-3.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-[9px] border border-border-2 bg-card py-2.5 text-[13.5px] font-semibold text-muted hover:bg-[#F3F5F8]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="flex-1 rounded-[9px] bg-primary py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-primary-hover"
          >
            Criar {etapas.length} {etapas.length === 1 ? 'dia' : 'dias'} na programação
          </button>
        </div>
      </aside>
    </>
  )
}
