import { ABAS } from '../lib/board'
import { boolOn, fieldSatisfied, fieldValue } from '../lib/fields'
import { brl, fmtDay } from '../lib/format'
import { toYMD } from '../lib/prazos'
import type { BoardItem } from '../lib/types'
import { Icon } from './Icon'
import { isLate } from './Stats'

// Dias inteiros desde a última atualização do processo.
function diasSem(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function Pill({ good, label, icon }: { good: boolean; label: string; icon?: 'check' | 'x' | 'clock' | 'alert' }) {
  const ic = icon ?? (good ? 'check' : 'x')
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ' +
        (good ? 'bg-[#EAF6EC] text-[#15803d]' : 'bg-[#FCEBEA] text-[#b91c1c]')
      }
    >
      <Icon name={ic} className="h-[11px] w-[11px] [stroke-width:2.4]" />
      {label}
    </span>
  )
}

function Indicators({ item }: { item: BoardItem }) {
  const { campos, status } = item.processo
  if (status === 'fechadas') {
    return (
      <>
        <Pill good={fieldSatisfied(campos, 'f_contrato')} label="Contrato" />
        <Pill good={fieldSatisfied(campos, 'f_relacao')} label="Relação" />
        <Pill good={fieldSatisfied(campos, 'f_sinal')} label="Sinal" />
      </>
    )
  }
  if (status === 'faturamento') {
    const fisc = fieldValue(campos, 'fa_fiscal')
    const forma = fieldValue(campos, 'fa_forma')
    const placa = fieldValue(campos, 'fa_placa')
    return (
      <>
        {fisc ? <Pill good label={fisc} /> : <Pill good={false} label="Fiscal" />}
        {forma ? <Pill good label={forma.split(' ')[0]} /> : <Pill good={false} label="Pgto" />}
        {placa ? <Pill good label="Placa" /> : <Pill good={false} label="Placa" />}
      </>
    )
  }
  if (status === 'acompanhamento') {
    const venc = fieldValue(campos, 'ac_venc')
    const avaria = fieldValue(campos, 'ac_avaria') === 'sim'
    const receb = boolOn(campos, 'ac_receb')
    return (
      <>
        {venc ? (
          <Pill good label={`Venc. ${fmtDay(venc)}`} icon="clock" />
        ) : (
          <Pill good={false} label="Vencimento" />
        )}
        {avaria && (
          <Pill good={false} label={`Avaria ${fieldValue(campos, 'ac_avaria_valor')}`} icon="alert" />
        )}
        {receb ? <Pill good label="Recebido" /> : <Pill good={false} label="Receb." />}
      </>
    )
  }
  return <Pill good label="Concluído" />
}

export function ProcessCard({
  item,
  vendedor,
  onClick,
}: {
  item: BoardItem
  vendedor: string | null
  onClick: () => void
}) {
  const { deal, processo, installments } = item
  const st = ABAS[processo.status]
  const terceirizado = !!(deal.parceiro && deal.parceiro.trim())
  const late = processo.status === 'acompanhamento' && installments.some(isLate)
  const ativo = processo.status !== 'recebido'
  const mudancaHoje = ativo && !!deal.data_mudanca && deal.data_mudanca === toYMD(new Date())
  const diasParado = diasSem(processo.updated_at)
  const parado = ativo && diasParado >= 2

  return (
    <button
      onClick={onClick}
      className="relative w-full shrink-0 overflow-hidden rounded-[13px] border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-border-2 hover:shadow-md"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: st.color }} />
      <div className="mb-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-tight">
          {deal.nome}
        </span>
      </div>
      <div className="mb-2.5 flex items-center gap-1.5 text-[12.5px] text-muted">
        <Icon name="map" className="h-[13px] w-[13px] flex-none text-muted-2" />
        <span className="truncate">{deal.origem || '—'}</span>
        <Icon name="arrow" className="h-[13px] w-[13px] flex-none text-muted-2" />
        <span className="truncate">{deal.destino || '—'}</span>
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {deal.tipo_servico && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#F3F5F8] px-2 py-0.5 text-[10.5px] font-medium capitalize text-muted">
            <Icon name="box" className="h-3 w-3" />
            {deal.tipo_servico}
          </span>
        )}
        <span
          className={
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ' +
            (terceirizado
              ? 'border-[#F6E0A6] bg-[#FEF6E3] text-[#92610a]'
              : 'border-border bg-[#F3F5F8] text-muted')
          }
        >
          <Icon name="truck" className="h-3 w-3" />
          {terceirizado ? `Terceiro · ${deal.parceiro}` : 'Frota própria'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-bold tracking-tight">{brl(deal.valor)}</span>
        <span className="text-[11.5px] text-muted-2">
          {processo.status === 'fechadas' ? 'prev. ' : 'exec. '}
          {fmtDay(deal.data_mudanca)}
        </span>
      </div>
      {vendedor && (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
          <Icon name="users" className="h-3 w-3 text-muted-2" />
          Vendedor: <span className="font-medium text-text">{vendedor}</span>
        </div>
      )}
      <div className="mt-2.5 flex gap-1.5 border-t border-border pt-2.5">
        <Indicators item={item} />
      </div>
      {mudancaHoje && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-[9px] border border-[#CFE0F5] bg-primary-weak px-2 py-2 text-[11px] font-semibold leading-snug text-primary">
          <Icon name="calendar" className="h-[13px] w-[13px] flex-none" />
          <span>A mudança é hoje!</span>
        </div>
      )}
      {parado && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-[9px] border border-[#F6E0A6] bg-[#FEF6E3] px-2 py-2 text-[11px] font-medium leading-snug text-[#92610a]">
          <Icon name="clock" className="mt-px h-[13px] w-[13px] flex-none" />
          <span>Contrato parado há {diasParado} dias — revisar.</span>
        </div>
      )}
      {late && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-[9px] border border-[#F6D3D0] bg-[#FCEBEA] px-2 py-2 text-[11px] font-medium leading-snug text-[#b91c1c]">
          <Icon name="alert" className="mt-px h-[13px] w-[13px] flex-none" />
          <span>Parcela vencida em aberto — verificar recebimento.</span>
        </div>
      )}
    </button>
  )
}
