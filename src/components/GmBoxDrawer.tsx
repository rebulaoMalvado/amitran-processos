import { useMemo, useState } from 'react'
import type { UseGuardaMoveis } from '../hooks/useGuardaMoveis'
import { brl } from '../lib/format'
import { STATUS_LABEL, statusLocacao, type BoxStatus } from '../lib/gmStatus'
import type { GmBox, GmLocacao, GmPagamento } from '../lib/types'
import { Icon } from './Icon'

const inputCls =
  'w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak'

const TAG_STYLE: Record<BoxStatus, string> = {
  pago: 'bg-[#DCFCE7] text-[#15803D]',
  vencido: 'bg-[#FEE2E2] text-[#B91C1C]',
  proximo: 'bg-[#FEF3C7] text-[#B45309]',
  aberto: 'bg-[#F1F5F9] text-[#475569]',
  vago: 'bg-[#F1F5F9] text-[#64748B]',
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtMes(mesRef: string): string {
  const [ano, mes] = mesRef.split('-').map(Number)
  return `${MESES_CURTO[mes - 1]}/${String(ano).slice(2)}`
}
function fmtData(ymd: string | null): string {
  if (!ymd) return '—'
  const [a, m, d] = ymd.slice(0, 10).split('-')
  return `${d}/${m}/${a.slice(2)}`
}

export function GmBoxDrawer({
  box,
  locs,
  encerradas,
  pagamentos,
  mesRef,
  mesLabel,
  hoje,
  gm,
  onClose,
}: {
  box: GmBox
  locs: GmLocacao[]
  encerradas: GmLocacao[]
  pagamentos: GmPagamento[]
  mesRef: string
  mesLabel: string
  hoje: Date
  gm: UseGuardaMoveis
  onClose: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [showEncerradas, setShowEncerradas] = useState(false)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[rgba(15,23,42,.4)]" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-[420px] max-w-[94vw] flex-col bg-card shadow-lg">
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-[#EEF0FE] text-[#6366F1]">
            <Icon name="archive" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold tracking-tight">Box #{box.numero}</div>
            <div className="text-[12px] text-muted">
              {box.ativo ? `${locs.length} cliente(s) · mês de ${mesLabel}` : 'Uso interno'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[#F1F5F9] text-muted hover:text-text"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {box.observacao && (
            <div className="flex gap-2 rounded-[10px] border border-[#FDE9A9] bg-[#FFFBEB] px-3 py-2.5 text-[12.5px] text-[#92620A]">
              <Icon name="info" className="h-4 w-4 flex-none" />
              <span>{box.observacao}</span>
            </div>
          )}

          {!box.ativo && (
            <p className="text-[13px] text-muted-2">
              Box de uso interno da Amitran — não entra na cobrança de locação.
            </p>
          )}

          {box.ativo && locs.length === 0 && !adding && (
            <div className="rounded-[11px] border border-dashed border-border-2 py-8 text-center text-[13px] text-muted-2">
              Box vago — disponível para locação.
            </div>
          )}

          {locs.map((l) => (
            <LocacaoCard
              key={l.id}
              loc={l}
              pagamentos={pagamentos.filter((p) => p.locacao_id === l.id)}
              mesRef={mesRef}
              hoje={hoje}
              gm={gm}
            />
          ))}

          {box.ativo && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-2 py-2.5 text-[13px] font-semibold text-primary hover:bg-primary-weak"
            >
              <Icon name="plus" className="h-4 w-4" />
              Adicionar cliente ao box
            </button>
          )}

          {adding && (
            <AddClienteForm
              onCancel={() => setAdding(false)}
              onSave={async (f) => {
                await gm.addLocacao({
                  box_numero: box.numero,
                  cliente_nome: f.cliente_nome,
                  volume_m3: f.volume_m3,
                  valor_mensal: f.valor_mensal,
                  dia_vencimento: f.dia_vencimento,
                  data_inicio: f.data_inicio,
                  obs: null,
                })
                setAdding(false)
              }}
            />
          )}

          {encerradas.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setShowEncerradas((v) => !v)}
                className="flex w-full items-center gap-1.5 text-[12px] font-semibold text-muted-2 hover:text-text"
              >
                <Icon
                  name="chevron"
                  className={'h-3.5 w-3.5 transition-transform ' + (showEncerradas ? 'rotate-90' : '')}
                />
                Locações encerradas ({encerradas.length})
              </button>
              {showEncerradas &&
                encerradas.map((l) => (
                  <div
                    key={l.id}
                    className="mt-2 rounded-[10px] border border-border bg-[#FAFBFC] px-3 py-2.5 text-[12.5px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted">{l.cliente_nome}</span>
                      <span className="text-[11.5px] text-muted-2">
                        encerrada {fmtData(l.data_fim)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-muted-2">
                      {l.volume_m3 ? `${l.volume_m3} m³ · ` : ''}
                      {l.valor_mensal != null ? brl(l.valor_mensal) + '/mês' : 'valor n/d'}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// ---- Card de uma locação (cliente no box) ----
function LocacaoCard({
  loc,
  pagamentos,
  mesRef,
  hoje,
  gm,
}: {
  loc: GmLocacao
  pagamentos: GmPagamento[]
  mesRef: string
  hoje: Date
  gm: UseGuardaMoveis
}) {
  const [editing, setEditing] = useState(false)
  const [showHist, setShowHist] = useState(false)
  const [marking, setMarking] = useState(false)

  const pagMes = pagamentos.find((p) => p.mes_referencia === mesRef)
  const status = statusLocacao(loc, pagMes, mesRef, hoje)
  const histOrdenado = useMemo(
    () => [...pagamentos].sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1)),
    [pagamentos],
  )
  const pagos = histOrdenado.filter((p) => p.pago)
  const totalRecebido = pagos.reduce((s, p) => s + Number(p.valor), 0)

  if (editing) {
    return (
      <EditClienteForm
        loc={loc}
        onCancel={() => setEditing(false)}
        onSave={async (patch) => {
          await gm.editLocacao(loc.id, patch)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="rounded-[12px] border border-border bg-card p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-tight tracking-tight">
            {loc.cliente_nome}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">
            {loc.volume_m3 ? `${loc.volume_m3} m³` : 'volume n/d'} ·{' '}
            {loc.valor_mensal != null ? `${brl(loc.valor_mensal)}/mês` : 'valor n/d'} ·{' '}
            {loc.dia_vencimento ? `vence dia ${loc.dia_vencimento}` : 'sem vencimento'}
          </div>
        </div>
        <span
          className={
            'flex-none rounded-md px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.03em] ' +
            TAG_STYLE[status]
          }
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Ação do mês */}
      {marking ? (
        <MarcarPagoForm
          defaultValor={pagMes?.valor ?? loc.valor_mensal ?? 0}
          onCancel={() => setMarking(false)}
          onSave={async (valor) => {
            await gm.marcarPago(loc.id, mesRef, valor)
            setMarking(false)
          }}
        />
      ) : pagMes?.pago ? (
        <div className="mt-2.5 flex items-center justify-between rounded-[9px] bg-[#F0FAF2] px-3 py-2 text-[12.5px]">
          <span className="font-medium text-[#15803D]">
            Pago · {brl(pagMes.valor)}
            {pagMes.data_pagamento ? ` em ${fmtData(pagMes.data_pagamento)}` : ''}
          </span>
          <button
            onClick={() => gm.desmarcarPago(loc.id, mesRef, pagMes.valor)}
            className="text-[12px] font-semibold text-muted-2 hover:text-[#B91C1C]"
          >
            desfazer
          </button>
        </div>
      ) : (
        <button
          onClick={() => setMarking(true)}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-primary py-2 text-[13px] font-semibold text-white hover:bg-primary-hover"
        >
          <Icon name="check" className="h-4 w-4" />
          Marcar como pago
        </button>
      )}

      {/* Rodapé de ações */}
      <div className="mt-2.5 flex items-center gap-3 border-t border-border pt-2.5 text-[12px]">
        <button
          onClick={() => setShowHist((v) => !v)}
          className="inline-flex items-center gap-1 font-semibold text-muted hover:text-text"
        >
          <Icon name="clock" className="h-3.5 w-3.5" />
          Histórico ({pagos.length})
        </button>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 font-semibold text-muted hover:text-text"
        >
          <Icon name="edit" className="h-3.5 w-3.5" />
          Editar
        </button>
        <div className="flex-1" />
        <button
          onClick={() => {
            const hojeYMD = new Date().toISOString().slice(0, 10)
            if (confirm(`Encerrar a locação de ${loc.cliente_nome}? (data fim = hoje)`))
              gm.encerrarLocacao(loc.id, hojeYMD)
          }}
          className="font-semibold text-muted-2 hover:text-[#B45309]"
        >
          Encerrar
        </button>
        <button
          onClick={() => {
            if (confirm(`Remover ${loc.cliente_nome} do box? Isto apaga o histórico de pagamentos dele.`))
              gm.removeLocacao(loc.id)
          }}
          className="font-semibold text-muted-2 hover:text-[#B91C1C]"
        >
          Remover
        </button>
      </div>

      {showHist && (
        <div className="mt-2.5 rounded-[10px] border border-border bg-[#FAFBFC] p-2.5">
          {histOrdenado.length === 0 ? (
            <div className="py-2 text-center text-[12px] text-muted-2">
              Nenhum pagamento registrado ainda.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-[12px]">
                {histOrdenado.map((p) => (
                  <div key={p.id} className="contents">
                    <span className="capitalize text-muted">{fmtMes(p.mes_referencia)}</span>
                    <span
                      className={
                        'text-right font-medium ' + (p.pago ? 'text-[#15803D]' : 'text-[#B45309]')
                      }
                    >
                      {p.pago ? 'pago' : 'em aberto'}
                    </span>
                    <span className="text-right tabular-nums">
                      {brl(p.valor)}
                      {p.pago && p.data_pagamento ? (
                        <span className="ml-1 text-[11px] text-muted-2">
                          {fmtData(p.data_pagamento)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-[12px]">
                <span className="text-muted">Total quitado</span>
                <span className="font-semibold">{brl(totalRecebido)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Formulários ----
function MarcarPagoForm({
  defaultValor,
  onCancel,
  onSave,
}: {
  defaultValor: number
  onCancel: () => void
  onSave: (valor: number) => void
}) {
  const [valor, setValor] = useState(String(defaultValor || ''))
  return (
    <div className="mt-2.5 rounded-[9px] border border-border-2 bg-[#F8FAFC] p-2.5">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2">
        Valor recebido (R$)
      </label>
      <div className="flex gap-2">
        <input
          autoFocus
          type="number"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={inputCls}
          placeholder="0,00"
        />
        <button
          onClick={() => onSave(Number(valor) || 0)}
          className="flex-none rounded-[9px] bg-primary px-3 text-[13px] font-semibold text-white hover:bg-primary-hover"
        >
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="flex-none rounded-[9px] border border-border-2 px-3 text-[13px] font-medium text-muted hover:bg-card"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

interface ClienteFormValues {
  cliente_nome: string
  volume_m3: number | null
  valor_mensal: number | null
  dia_vencimento: number | null
  data_inicio: string | null
}

function AddClienteForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (f: ClienteFormValues) => void
}) {
  return (
    <ClienteFields
      title="Novo cliente no box"
      initial={{ cliente_nome: '', volume_m3: null, valor_mensal: null, dia_vencimento: null, data_inicio: null }}
      onCancel={onCancel}
      onSave={onSave}
    />
  )
}

function EditClienteForm({
  loc,
  onCancel,
  onSave,
}: {
  loc: GmLocacao
  onCancel: () => void
  onSave: (patch: Partial<GmLocacao>) => void
}) {
  return (
    <ClienteFields
      title={`Editar · ${loc.cliente_nome}`}
      initial={{
        cliente_nome: loc.cliente_nome,
        volume_m3: loc.volume_m3,
        valor_mensal: loc.valor_mensal,
        dia_vencimento: loc.dia_vencimento,
        data_inicio: loc.data_inicio,
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  )
}

function ClienteFields({
  title,
  initial,
  onCancel,
  onSave,
}: {
  title: string
  initial: ClienteFormValues
  onCancel: () => void
  onSave: (f: ClienteFormValues) => void
}) {
  const [nome, setNome] = useState(initial.cliente_nome)
  const [vol, setVol] = useState(initial.volume_m3 != null ? String(initial.volume_m3) : '')
  const [valor, setValor] = useState(initial.valor_mensal != null ? String(initial.valor_mensal) : '')
  const [dia, setDia] = useState(initial.dia_vencimento != null ? String(initial.dia_vencimento) : '')
  const [inicio, setInicio] = useState(initial.data_inicio ?? '')

  const num = (s: string) => (s.trim() === '' ? null : Number(s))

  return (
    <div className="rounded-[12px] border border-primary/40 bg-primary-weak/40 p-3.5">
      <div className="mb-2.5 text-[13px] font-semibold">{title}</div>
      <div className="flex flex-col gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2">
            Cliente
          </label>
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={inputCls}
            placeholder="Nome do cliente"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2">
              Volume (m³)
            </label>
            <input
              type="number"
              step="0.5"
              value={vol}
              onChange={(e) => setVol(e.target.value)}
              className={inputCls}
              placeholder="n/d"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2">
              Valor mensal (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputCls}
              placeholder="a preencher"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2">
              Dia de vencimento
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className={inputCls}
              placeholder="1–31"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2">
              Início
            </label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={!nome.trim()}
          onClick={() =>
            onSave({
              cliente_nome: nome.trim(),
              volume_m3: num(vol),
              valor_mensal: num(valor),
              dia_vencimento: num(dia),
              data_inicio: inicio.trim() === '' ? null : inicio,
            })
          }
          className="flex-1 rounded-[9px] bg-primary py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded-[9px] border border-border-2 py-2 text-[13px] font-medium text-muted hover:bg-card"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
