// Modelo do board — espelha amitran-processos-v1_1.html (fonte de verdade).
import type { FieldEntry, ProcessoStatus } from './types'

export interface AbaDef {
  key: ProcessoStatus
  label: string
  color: string
}

export const ABAS: Record<ProcessoStatus, AbaDef> = {
  fechadas: { key: 'fechadas', label: 'Mudanças Fechadas', color: '#6366F1' },
  faturamento: { key: 'faturamento', label: 'Faturamento', color: '#EAB308' },
  acompanhamento: {
    key: 'acompanhamento',
    label: 'Acompanhamento do Contrato',
    color: '#3B82F6',
  },
  recebido: { key: 'recebido', label: 'Recebido / Baixado', color: '#22C55E' },
}

export const COL_ORDER: ProcessoStatus[] = [
  'fechadas',
  'faturamento',
  'acompanhamento',
  'recebido',
]

export const NEXT: Record<ProcessoStatus, ProcessoStatus | null> = {
  fechadas: 'faturamento',
  faturamento: 'acompanhamento',
  acompanhamento: 'recebido',
  recebido: null,
}

export type FieldType = 'bool' | 'text' | 'select' | 'avaria' | 'venc'

export interface FieldDef {
  id: string
  type: FieldType
  label: string
  req?: boolean
  ph?: string
  options?: string[]
  // Se presente, o campo só aparece quando o predicado for verdadeiro
  // (campos condicionais — dependem do valor de outro campo).
  showIf?: (campos: Record<string, FieldEntry>) => boolean
}

export const FIELDS: Record<ProcessoStatus, FieldDef[]> = {
  fechadas: [
    { id: 'f_contrato', type: 'bool', label: 'Contrato assinado', req: true },
    { id: 'f_relacao', type: 'bool', label: 'Relação de bens', req: true },
    {
      id: 'f_sinal',
      type: 'text',
      label: 'Valor do sinal / Pedido de compra',
      req: true,
      ph: 'Ex: R$ 1.530 ou PC 4471',
    },
    { id: 'f_vias', type: 'bool', label: '2 vias da ficha' },
  ],
  faturamento: [
    {
      id: 'fa_forma',
      type: 'select',
      label: 'Forma de pagamento',
      options: ['Boleto', 'Pix', 'Portal / Faturamento', 'Cartão de Crédito', 'Dinheiro'],
    },
    {
      id: 'fa_dados',
      type: 'text',
      label: 'Dados de faturamento (CPF ou Pedido de Compras)',
      ph: 'CPF ou nº do PC',
    },
    {
      id: 'fa_fiscal',
      type: 'select',
      label: 'Documento fiscal',
      options: ['CTE', 'Nota Fiscal', 'Sem Nota Fiscal'],
    },
    {
      id: 'fa_num_nf',
      type: 'text',
      label: 'Número da Nota Fiscal',
      ph: 'Nº da NF',
      showIf: (c) => c['fa_fiscal']?.value === 'Nota Fiscal',
    },
    {
      id: 'fa_num_cte',
      type: 'text',
      label: 'Número do CTE',
      ph: 'Nº do CTE',
      showIf: (c) => c['fa_fiscal']?.value === 'CTE',
    },
    { id: 'fa_averba', type: 'bool', label: 'Averbação Porto' },
    { id: 'fa_danfe', type: 'bool', label: 'DANFE' },
    {
      id: 'fa_num_danfe',
      type: 'text',
      label: 'Número do DANFE',
      ph: 'Nº do DANFE',
      showIf: (c) => !!c['fa_danfe']?.by,
    },
    { id: 'fa_motorista', type: 'text', label: 'Nome do motorista', ph: 'Nome' },
    { id: 'fa_placa', type: 'text', label: 'Placa do caminhão', ph: 'ABC-1D23' },
    { id: 'fa_enviado_faturamento', type: 'bool', label: 'Enviado para Faturamento' },
  ],
  acompanhamento: [
    { id: 'ac_venc', type: 'venc', label: 'Aviso de vencimento' },
    { id: 'ac_avaria', type: 'avaria', label: 'Avaria' },
    { id: 'ac_receb', type: 'bool', label: 'Recebimento conferido', req: true },
  ],
  recebido: [],
}

export const REQUIRED: Record<ProcessoStatus, string[]> = {
  fechadas: ['f_contrato', 'f_relacao', 'f_sinal'],
  faturamento: [],
  acompanhamento: ['ac_receb'],
  recebido: [],
}

// Índice id -> def (inclui o campo auxiliar do valor da avaria).
export const ALL_FIELDS: Record<string, FieldDef> = {}
for (const list of Object.values(FIELDS)) {
  for (const f of list) ALL_FIELDS[f.id] = f
}
ALL_FIELDS['ac_avaria_valor'] = {
  id: 'ac_avaria_valor',
  type: 'text',
  label: 'Valor da avaria',
}
