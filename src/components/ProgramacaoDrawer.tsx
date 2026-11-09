import { useMemo, useState, type ReactNode } from 'react'
import { nomeCaminhao, nomePessoa } from '../hooks/useProgramacao'
import {
  addChapa,
  detectarConflitos,
  GRUPO_LABEL,
  grupoPessoa,
  localSugerido,
  STATUS_LABEL,
  TIPOS,
  TIPO_KEYS,
  type NewProgramacao,
} from '../lib/programacao'
import { fmtDay } from '../lib/format'
import type { Caminhao, Colaborador, DealProg, ProgStatus, ProgTipo, Programacao } from '../lib/types'
import { Icon } from './Icon'

export const inputCls =
  'w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[12px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  )
}

// Seletor de equipe: motoristas e ajudantes (do cadastro) + chapas freelancer
// (só o nome, digitado). Compartilhado com o drawer de roteiro.
export function EquipePicker({
  pessoas,
  value,
  onChange,
  freelancers,
  onFreelancers,
}: {
  pessoas: Colaborador[]
  value: string[]
  onChange: (v: string[]) => void
  freelancers: string[]
  onFreelancers: (v: string[]) => void
}) {
  const [nome, setNome] = useState('')
  const grupos = (['motorista', 'ajudante'] as const).map((g) => ({
    g,
    lista: pessoas.filter((p) => grupoPessoa(p.funcao) === g),
  }))

  function addChapaAgora() {
    const novo = addChapa(freelancers, nome)
    if (novo !== freelancers) onFreelancers(novo)
    setNome('')
  }

  return (
    <div className="flex flex-col gap-2.5">
      {grupos.map(({ g, lista }) => (
        <div key={g}>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-2">
            {GRUPO_LABEL[g]}
          </div>
          {lista.length === 0 ? (
            <div className="text-[12px] text-muted-2">Nenhum cadastrado.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {lista.map((p) => {
                const on = value.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
                    className={
                      'rounded-full border px-2.5 py-1 text-[12px] font-medium ' +
                      (on
                        ? 'border-primary bg-primary-weak text-primary'
                        : 'border-border-2 text-muted hover:bg-[#F3F5F8]')
                    }
                  >
                    {nomePessoa(p)}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}

      <div>
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-2">
          Chapa freelancer
        </div>
        {freelancers.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {freelancers.map((n) => (
              <span
                key={n}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#F6E0A6] bg-[#FEF6E3] py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-[#92610a]"
              >
                {n}
                <button
                  type="button"
                  onClick={() => onFreelancers(freelancers.filter((x) => x !== n))}
                  title="Remover chapa"
                  className="grid h-4 w-4 place-items-center rounded-full hover:bg-[#F6E0A6]"
                >
                  <Icon name="x" className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            className={inputCls + ' !py-1.5'}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addChapaAgora()
              }
            }}
            placeholder="Nome do chapa (ex: José)"
          />
          <button
            type="button"
            onClick={addChapaAgora}
            disabled={!nome.trim()}
            className="flex-none rounded-[9px] border border-border-2 bg-card px-3 text-[12.5px] font-semibold text-muted hover:bg-[#F3F5F8] disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

export function Conflitos({ msgs }: { msgs: string[] }) {
  if (msgs.length === 0) return null
  return (
    <div className="mb-3.5 rounded-lg border border-[#F6D3D0] bg-[#FCEBEA] px-3 py-2 text-[12.5px] font-medium text-[#b91c1c]">
      {msgs.map((m) => (
        <div key={m} className="flex items-start gap-1.5">
          <Icon name="alert" className="mt-px h-[13px] w-[13px] flex-none" />
          <span>{m}</span>
        </div>
      ))}
    </div>
  )
}

type Executor = 'frota' | 'terceiro' | 'nenhum'

export function ProgramacaoDrawer({
  evento,
  inicial,
  eventos,
  deals,
  caminhoes,
  pessoas,
  labelCaminhao,
  labelPessoa,
  onClose,
  onSave,
  onDelete,
}: {
  evento: Programacao | null // null = nova
  inicial?: Partial<Programacao> // pré-preenchimento ao criar
  eventos: Programacao[]
  deals: DealProg[]
  caminhoes: Caminhao[]
  pessoas: Colaborador[]
  labelCaminhao: (id: string) => string
  labelPessoa: (id: string) => string
  onClose: () => void
  onSave: (row: Omit<NewProgramacao, 'created_by'>) => void
  onDelete?: () => void
}) {
  const base = evento ?? inicial ?? {}
  const [data, setData] = useState(base.data ?? '')
  const [tipo, setTipo] = useState<ProgTipo>(base.tipo ?? 'coleta')
  const [status, setStatus] = useState<ProgStatus>(base.status ?? 'previsto')
  const [dealId, setDealId] = useState<string | null>(base.deal_id ?? null)
  const [cliente, setCliente] = useState(base.cliente ?? '')
  const [executor, setExecutor] = useState<Executor>(
    base.terceiro ? 'terceiro' : base.caminhao_id ? 'frota' : base.id ? 'nenhum' : 'frota',
  )
  const [caminhaoId, setCaminhaoId] = useState<string | null>(base.caminhao_id ?? null)
  const [local, setLocal] = useState(base.local ?? '')
  const [equipe, setEquipe] = useState<string[]>(base.equipe ?? [])
  const [freelancers, setFreelancers] = useState<string[]>(base.freelancers ?? [])
  const [obs, setObs] = useState(base.obs ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmaExcluir, setConfirmaExcluir] = useState(false)

  const deal = deals.find((d) => d.id === dealId) ?? null

  function escolherDeal(id: string) {
    const d = deals.find((x) => x.id === id) ?? null
    setDealId(d ? d.id : null)
    if (d) {
      setCliente(d.nome)
      if (!local.trim()) setLocal(localSugerido(tipo, d))
      if (d.parceiro?.trim() && executor === 'frota' && !caminhaoId) setExecutor('terceiro')
    }
  }

  function escolherTipo(t: ProgTipo) {
    // Se o local ainda é o que o sistema sugeriu, acompanha o novo tipo.
    if (!local.trim() || local === localSugerido(tipo, deal)) setLocal(localSugerido(t, deal))
    // Embalagem normalmente é só equipe, sem caminhão.
    if (t === 'embalagem' && executor === 'frota' && !caminhaoId) setExecutor('nenhum')
    setTipo(t)
  }

  const draft: Programacao = {
    id: evento?.id ?? '__novo__',
    data,
    tipo,
    status,
    deal_id: dealId,
    cliente: cliente.trim() || null,
    caminhao_id: executor === 'frota' ? caminhaoId : null,
    terceiro: executor === 'terceiro',
    local: local.trim() || null,
    equipe,
    freelancers,
    obs: obs.trim() || null,
    created_by: null,
    created_at: '',
    updated_at: '',
  }
  const msgs = useMemo(() => {
    if (!data) return []
    const todos = [...eventos.filter((e) => e.id !== draft.id), draft]
    return detectarConflitos(todos, labelCaminhao, labelPessoa).get(draft.id) ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, data, tipo, status, dealId, cliente, executor, caminhaoId, equipe, freelancers])

  function submit() {
    if (!data) return setErro('Informe o dia.')
    if (executor === 'frota' && !caminhaoId) return setErro('Escolha o caminhão (ou marque Terceiro / Sem caminhão).')
    if (!cliente.trim() && !local.trim() && tipo !== 'manutencao')
      return setErro('Informe a mudança (cliente) ou o local.')
    setErro(null)
    onSave({
      data: draft.data,
      tipo: draft.tipo,
      status: draft.status,
      deal_id: draft.deal_id,
      cliente: draft.cliente,
      caminhao_id: draft.caminhao_id,
      terceiro: draft.terceiro,
      local: draft.local,
      equipe: draft.equipe,
      freelancers: draft.freelancers,
      obs: draft.obs,
    })
  }

  const segBtn = (on: boolean) =>
    'flex-1 px-2.5 py-2 text-[12.5px] font-medium ' + (on ? 'bg-primary text-white' : 'bg-card text-muted')

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]" />
      <aside className="fixed right-0 top-0 z-[80] flex h-screen w-[min(460px,96vw)] flex-col border-l border-border bg-card shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="text-[17px] font-bold tracking-tight">
            {evento ? 'Editar atividade' : 'Nova atividade'}
          </div>
          <button
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia *">
              <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <Field label="Situação">
              <div className="flex overflow-hidden rounded-[9px] border border-border-2">
                {(Object.keys(STATUS_LABEL) as ProgStatus[]).map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={segBtn(status === s) + (i > 0 ? ' border-l border-border-2' : '')}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="O que vai acontecer *">
            <div className="flex flex-wrap gap-1.5">
              {TIPO_KEYS.map((k) => {
                const t = TIPOS[k]
                const on = tipo === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => escolherTipo(k)}
                    className="rounded-full border px-2.5 py-1 text-[12px] font-medium"
                    style={
                      on
                        ? { background: t.bg, color: t.fg, borderColor: t.fg }
                        : { background: '#fff', color: '#64748B', borderColor: '#DDE0E6' }
                    }
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Mudança (cliente)">
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
              />
            )}
          </Field>

          <Field label="Quem faz">
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
              <button
                type="button"
                onClick={() => setExecutor('nenhum')}
                className={segBtn(executor === 'nenhum') + ' border-l border-border-2'}
              >
                Sem caminhão
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
            {executor === 'terceiro' && deal?.parceiro?.trim() && (
              <div className="mt-1.5 text-[12px] text-muted-2">Parceiro no CRM: {deal.parceiro}</div>
            )}
          </Field>

          <Field label="Local / trajeto">
            <input
              className={inputCls}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Belo Horizonte → São Paulo"
            />
          </Field>

          <Field label="Equipe">
            <EquipePicker
              pessoas={pessoas}
              value={equipe}
              onChange={setEquipe}
              freelancers={freelancers}
              onFreelancers={setFreelancers}
            />
          </Field>

          <Field label="Observação">
            <textarea
              className={inputCls + ' min-h-[64px] resize-y'}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Horário, contato no local, pendências…"
            />
          </Field>

          <Conflitos msgs={msgs} />
          {erro && (
            <div className="mt-1 rounded-lg border border-[#F6D3D0] bg-[#FCEBEA] px-3 py-2 text-[12.5px] font-medium text-[#b91c1c]">
              {erro}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-3.5">
          {evento && onDelete && (
            <button
              onClick={() => (confirmaExcluir ? onDelete() : setConfirmaExcluir(true))}
              className={
                'flex items-center gap-1.5 rounded-[9px] border px-3 py-2.5 text-[13.5px] font-semibold ' +
                (confirmaExcluir
                  ? 'border-[#b91c1c] bg-[#b91c1c] text-white'
                  : 'border-[#F6D3D0] bg-card text-[#b91c1c] hover:bg-[#FCEBEA]')
              }
            >
              <Icon name="trash" className="h-4 w-4" />
              {confirmaExcluir ? 'Confirmar exclusão' : 'Excluir'}
            </button>
          )}
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
            Salvar
          </button>
        </div>
      </aside>
    </>
  )
}
