import { useState } from 'react'
import { ABAS, COL_ORDER, FIELDS, NEXT, REQUIRED, type FieldDef } from '../lib/board'
import { boolOn, fieldValue, missingRequired } from '../lib/fields'
import { avatarColor, brl, fmtDay, fmtStamp, initial } from '../lib/format'
import type { BoardItem, FieldEntry, Installment, Profile, ProcessoStatus } from '../lib/types'
import { VENC_THREAD_KEY, type useBoard } from '../hooks/useBoard'
import { Icon } from './Icon'
import { Thread } from './Thread'
import { isLate } from './Stats'

type BoardApi = ReturnType<typeof useBoard>

interface Props {
  item: BoardItem
  profiles: Record<string, Profile>
  board: BoardApi
  onClose: () => void
}

function Signature({ entry, profiles }: { entry?: FieldEntry; profiles: Record<string, Profile> }) {
  if (!entry?.by) return null
  const name = profiles[entry.by]?.name ?? 'Usuário'
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-2">
      <Icon name="check" className="h-[11px] w-[11px] text-st-recebido [stroke-width:2.6]" />
      {name} · {fmtStamp(entry.at)}
    </div>
  )
}

function ReqBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="ml-1.5 rounded-[5px] border border-[#F6E0A6] bg-[#FEF6E3] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#92610a] align-middle">
      obrigatório
    </span>
  )
}

function InstallmentsList({ installments }: { installments: Installment[] }) {
  if (!installments.length) return null
  const total = installments.length
  return (
    <div className="mt-2 rounded-[10px] border border-border bg-[#F7F8FA] p-3">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-2">
        Parcelas (deal_installments)
      </div>
      <div className="flex flex-col gap-1.5">
        {installments.map((i) => {
          const late = isLate(i)
          return (
            <div key={i.id} className="flex items-center gap-2 text-[12px]">
              <span className="font-medium text-text">
                {i.installment_number}/{total}
              </span>
              <span className="text-muted">{brl(Number(i.amount))}</span>
              <span className="text-muted-2">vence {fmtDay(i.due_date)}</span>
              <span
                className={
                  'ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold ' +
                  (i.is_received
                    ? 'bg-[#EAF6EC] text-[#15803d]'
                    : late
                      ? 'bg-[#FCEBEA] text-[#b91c1c]'
                      : 'bg-[#F1F3F6] text-muted')
                }
              >
                {i.is_received ? 'recebida' : late ? 'em atraso' : 'em aberto'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProcessDrawer({ item, profiles, board, onClose }: Props) {
  const { deal, processo, installments } = item
  const id = processo.id
  const campos = processo.campos
  const st = ABAS[processo.status]
  const terceirizado = !!(deal.parceiro && deal.parceiro.trim())
  const [showPast, setShowPast] = useState(false)

  const curIdx = COL_ORDER.indexOf(processo.status)
  const pastAbas = COL_ORDER.slice(0, curIdx) // etapas já concluídas

  function renderField(f: FieldDef, isCurrent: boolean) {
    const entry = campos[f.id]
    const isReq = isCurrent && (REQUIRED[processo.status] ?? []).includes(f.id)
    const unmet = isReq && !(f.type === 'bool' ? !!entry?.by : !!entry?.value)

    if (f.type === 'bool') {
      const on = boolOn(campos, f.id)
      return (
        <div
          key={f.id}
          onClick={() => board.toggleBool(id, f.id)}
          className="flex cursor-pointer items-start gap-3 rounded-[9px] border border-transparent px-2 py-2 hover:border-border hover:bg-[#F7F8FA]"
        >
          <div
            className={
              'mt-px grid h-[19px] w-[19px] flex-none place-items-center rounded-md border-[1.7px] ' +
              (on ? 'border-st-recebido bg-st-recebido text-white' : 'border-border-2 bg-card text-transparent')
            }
          >
            <Icon name="check" className="h-[13px] w-[13px] [stroke-width:3]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={'text-[13px] leading-snug ' + (on ? 'text-muted' : 'text-text')}>
              {f.label}
              <ReqBadge show={unmet} />
            </div>
            {on && <Signature entry={entry} profiles={profiles} />}
          </div>
        </div>
      )
    }

    if (f.type === 'text') {
      return (
        <div key={f.id} className="mb-2.5">
          <div className="mb-1.5 text-[12.5px] text-muted">
            {f.label}
            <ReqBadge show={unmet} />
          </div>
          <input
            defaultValue={entry?.value ?? ''}
            placeholder={f.ph}
            onBlur={(e) => {
              if ((e.target.value ?? '') !== (entry?.value ?? '')) board.setVal(id, f.id, e.target.value)
            }}
            className="w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
          />
          <Signature entry={entry} profiles={profiles} />
        </div>
      )
    }

    if (f.type === 'select') {
      return (
        <div key={f.id} className="mb-2.5">
          <div className="mb-1.5 text-[12.5px] text-muted">
            {f.label}
            <ReqBadge show={unmet} />
          </div>
          <select
            value={entry?.value ?? ''}
            onChange={(e) => board.setVal(id, f.id, e.target.value)}
            className="w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
          >
            <option value="">—</option>
            {f.options!.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Signature entry={entry} profiles={profiles} />
        </div>
      )
    }

    if (f.type === 'venc') {
      return (
        <div key={f.id} className="mb-2.5">
          <div className="mb-1.5 text-[12.5px] text-muted">{f.label}</div>
          <input
            type="date"
            defaultValue={entry?.value ?? ''}
            onChange={(e) => board.setVal(id, 'ac_venc', e.target.value)}
            className="w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
          />
          <Signature entry={entry} profiles={profiles} />
          <InstallmentsList installments={installments} />
          <Thread
            title="Atualizações"
            icon="clock"
            notes={processo.obs[VENC_THREAD_KEY] ?? []}
            profiles={profiles}
            onAdd={(t) => board.addVencUpdate(id, t)}
          />
        </div>
      )
    }

    // avaria
    const cur = fieldValue(campos, 'ac_avaria') || 'nao'
    return (
      <div key={f.id} className="mb-2.5">
        <div className="mb-1.5 text-[12.5px] text-muted">{f.label}</div>
        <div className="inline-flex overflow-hidden rounded-[9px] border border-border-2">
          <button
            onClick={() => board.setAvaria(id, 'nao')}
            className={
              'px-4 py-1.5 text-[12.5px] font-medium ' +
              (cur === 'nao' ? 'bg-muted text-white' : 'bg-card text-muted')
            }
          >
            Não
          </button>
          <button
            onClick={() => board.setAvaria(id, 'sim')}
            className={
              'border-l border-border-2 px-4 py-1.5 text-[12.5px] font-medium ' +
              (cur === 'sim' ? 'bg-primary text-white' : 'bg-card text-muted')
            }
          >
            Sim
          </button>
        </div>
        {cur === 'sim' && (
          <input
            defaultValue={fieldValue(campos, 'ac_avaria_valor')}
            placeholder="Valor da avaria (R$)"
            onBlur={(e) => board.setVal(id, 'ac_avaria_valor', e.target.value)}
            className="mt-2 w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
          />
        )}
      </div>
    )
  }

  // Renderiza uma etapa. `current` = etapa atual (destacada, campos obrigatórios ativos);
  // caso contrário é uma etapa concluída (marcada como tal).
  function renderStage(aba: ProcessoStatus, current: boolean) {
    return (
      <div
        key={aba}
        className={
          'rounded-[13px] border bg-card p-3.5 ' +
          (current
            ? 'border-primary shadow-[0_0_0_3px_var(--tw-ring-color)] ring-primary-weak'
            : 'border-border')
        }
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: ABAS[aba].color }} />
          <span className="text-[14px] font-bold tracking-tight">{ABAS[aba].label}</span>
          {current ? (
            <span className="ml-auto rounded-full border border-[#CFE0F5] bg-primary-weak px-2 py-px text-[10px] font-bold uppercase tracking-wide text-primary">
              etapa atual
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#BBE3C4] bg-[#EAF6EC] px-2 py-px text-[10px] font-bold uppercase tracking-wide text-[#15803d]">
              <Icon name="check" className="h-2.5 w-2.5 [stroke-width:3]" />
              concluída
            </span>
          )}
        </div>
        {FIELDS[aba].map((f) => renderField(f, current))}
        {FIELDS[aba].length === 0 && (
          <div className="mb-1 text-[12.5px] text-muted-2">
            Etapa final — sem campos a preencher, apenas observações e histórico.
          </div>
        )}
        <Thread
          title="Observações"
          icon="info"
          notes={processo.obs[aba] ?? []}
          profiles={profiles}
          onAdd={(t) => board.addObs(id, aba, t)}
        />
      </div>
    )
  }

  const next = NEXT[processo.status]
  const missing = missingRequired(processo)

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]"
      />
      <aside className="fixed right-0 top-0 z-[80] flex h-screen w-[min(500px,96vw)] flex-col border-l border-border bg-card shadow-lg">
        {/* Header */}
        <div className="border-b border-border px-5 pb-4 pt-[18px]">
          <div className="flex items-start gap-2.5">
            <div className="text-[20px] font-bold leading-tight tracking-tight">{deal.nome}</div>
            <button
              onClick={onClose}
              className="ml-auto grid h-8 w-8 flex-none place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] text-muted">
            <div className="flex items-center gap-2">
              <Icon name="route" className="h-3.5 w-3.5 flex-none text-muted-2" />
              <span className="truncate">
                {deal.origem || '—'} → {deal.destino || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="wallet" className="h-3.5 w-3.5 flex-none text-muted-2" />
              <b className="font-semibold text-text">{brl(deal.valor)}</b>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="box" className="h-3.5 w-3.5 flex-none text-muted-2" />
              <span className="capitalize">{deal.tipo_servico || 'serviço —'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="truck" className="h-3.5 w-3.5 flex-none text-muted-2" />
              <span>
                Transporte{' '}
                <b className="font-semibold text-text">
                  {terceirizado ? `Terceiro (${deal.parceiro})` : 'Frota própria'}
                </b>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="clock" className="h-3.5 w-3.5 flex-none text-muted-2" />
              <span>
                {processo.status === 'fechadas' ? 'Previsão ' : 'Execução '}
                <b className="font-semibold text-text">{fmtDay(deal.data_mudanca)}</b>
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white"
              style={{ background: st.color }}
            >
              <span className="h-[7px] w-[7px] rounded-full bg-white/90" />
              {st.label}
            </span>
            <select
              value={processo.status}
              onChange={(e) => board.moveStatus(id, e.target.value as ProcessoStatus)}
              title="Mover manualmente (fica registrado no log)"
              className="ml-auto rounded-[9px] border border-border-2 bg-card px-2 py-1.5 text-[12px] text-muted"
            >
              {COL_ORDER.map((k) => (
                <option key={k} value={k}>
                  Mover → {ABAS[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-[18px]">
          {/* Etapas concluídas — recolhidas por padrão. Futuras ficam ocultas. */}
          {pastAbas.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowPast((s) => !s)}
                className="flex w-full items-center gap-2 rounded-[10px] border border-border bg-[#F7F8FA] px-3 py-2.5 text-[12.5px] font-medium text-muted hover:bg-[#F1F3F6]"
              >
                <Icon
                  name="arrow"
                  className={'h-3.5 w-3.5 transition-transform ' + (showPast ? 'rotate-90' : '')}
                />
                {showPast ? 'Ocultar' : 'Ver'} etapas anteriores ({pastAbas.length})
              </button>
              {showPast && (
                <div className="mt-3 flex flex-col gap-4">
                  {pastAbas.map((aba) => renderStage(aba, false))}
                </div>
              )}
            </div>
          )}

          {/* Etapa atual */}
          <div className="mb-5">{renderStage(processo.status, true)}</div>

          {/* Avançar */}
          <div className="mt-1 rounded-xl border border-border bg-[#F7F8FA] p-3.5">
            {next ? (
              <>
                <button
                  disabled={missing.length > 0}
                  onClick={() => board.advance(id)}
                  className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-primary py-2.5 text-[13.5px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-[#E5E8ED] disabled:text-muted-2"
                >
                  <Icon name="arrow" className="h-4 w-4 [stroke-width:2.4]" />
                  Avançar para {ABAS[next].label}
                </button>
                {missing.length > 0 && (
                  <div className="mt-2.5 text-[12px] leading-snug text-st-danger">
                    <b className="font-semibold">Faltam:</b> {missing.join(' · ')}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-st-recebido">
                <Icon name="check" className="h-4 w-4" />
                Processo concluído — recebido e baixado
              </div>
            )}

            {curIdx > 0 && (
              <button
                onClick={() => board.regress(id)}
                title="Voltar o processo para a etapa anterior (fica registrado no histórico)"
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[9px] border border-border-2 bg-card py-2 text-[12.5px] font-medium text-muted hover:bg-[#F1F3F6]"
              >
                <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" />
                Voltar para {ABAS[COL_ORDER[curIdx - 1]].label}
              </button>
            )}
          </div>

          {/* Log */}
          <div className="mb-2.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-2">
            Histórico de ações
          </div>
          {processo.log.map((l, idx) => {
            const p = profiles[l.who]
            return (
              <div key={idx} className="flex gap-2.5 py-1.5">
                <span
                  className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] text-[10px] font-semibold text-white"
                  style={{ background: avatarColor(l.who) }}
                >
                  {initial(p?.name, '?')}
                </span>
                <div className="min-w-0 flex-1 text-[12px]">
                  <span className="font-semibold">{p?.name ?? 'Usuário'}</span>{' '}
                  <span className="text-muted">{l.txt}</span>
                  <div className="mt-px text-[11px] text-muted-2">{fmtStamp(l.at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
