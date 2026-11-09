import { supabase } from './supabase'
import { addDays } from './prazos'
import type { DealProg, ProgStatus, ProgTipo, Programacao } from './types'

const COLS =
  'id, data, tipo, status, deal_id, cliente, caminhao_id, terceiro, local, equipe, freelancers, obs, created_by, created_at, updated_at'

// ---------------------------------------------------------------------------
// Tipos de atividade (cores seguem a paleta do app).
// ---------------------------------------------------------------------------
export interface TipoDef {
  key: ProgTipo
  label: string
  bg: string
  fg: string
  border: string
}

export const TIPOS: Record<ProgTipo, TipoDef> = {
  embalagem: { key: 'embalagem', label: 'Embalagem', bg: '#FEF6E3', fg: '#92610a', border: '#F6E0A6' },
  coleta: { key: 'coleta', label: 'Coleta', bg: '#EEF0FE', fg: '#4F46E5', border: '#D5D8FB' },
  viagem: { key: 'viagem', label: 'Viagem', bg: '#EFF4FF', fg: '#2563EB', border: '#CFE0F5' },
  entrega: { key: 'entrega', label: 'Entrega', bg: '#EAF6EC', fg: '#15803d', border: '#BFE3C6' },
  retorno: { key: 'retorno', label: 'Retorno', bg: '#E6F7F8', fg: '#0E7490', border: '#B5E3E8' },
  manutencao: { key: 'manutencao', label: 'Manutenção', bg: '#FCEBEA', fg: '#b91c1c', border: '#F6D3D0' },
  outro: { key: 'outro', label: 'Outro', bg: '#F3F5F8', fg: '#64748B', border: '#E1E5EB' },
}

export const TIPO_KEYS = Object.keys(TIPOS) as ProgTipo[]

export const STATUS_LABEL: Record<ProgStatus, string> = {
  previsto: 'Previsto',
  feito: 'Feito',
  cancelado: 'Cancelado',
}

// ---------------------------------------------------------------------------
// Roteiros prontos para criar uma mudança inteira de uma vez.
// `offset` = dias depois da data de início.
// ---------------------------------------------------------------------------
export interface Etapa {
  tipo: ProgTipo
  offset: number
}

export const ROTEIROS: { key: string; label: string; etapas: Etapa[] }[] = [
  {
    key: 'viagem',
    label: 'Mudança com viagem (5 dias)',
    etapas: [
      { tipo: 'embalagem', offset: 0 },
      { tipo: 'coleta', offset: 1 },
      { tipo: 'viagem', offset: 2 },
      { tipo: 'entrega', offset: 3 },
      { tipo: 'retorno', offset: 4 },
    ],
  },
  {
    key: 'local',
    label: 'Mudança local (2 dias)',
    etapas: [
      { tipo: 'embalagem', offset: 0 },
      { tipo: 'coleta', offset: 1 },
      { tipo: 'entrega', offset: 1 },
    ],
  },
]

// Sugestão de "local" por tipo, a partir do deal escolhido.
export function localSugerido(tipo: ProgTipo, deal: DealProg | null): string {
  if (!deal) return ''
  const o = deal.origem?.trim() || ''
  const d = deal.destino?.trim() || ''
  if (tipo === 'embalagem' || tipo === 'coleta') return o
  if (tipo === 'entrega') return d
  if (tipo === 'viagem') return o && d ? `${o} → ${d}` : d || o
  return ''
}

// ---------------------------------------------------------------------------
// Chave de agrupamento: eventos da MESMA mudança não conflitam entre si.
// ---------------------------------------------------------------------------
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

// O nome do cliente vem primeiro: assim "João" digitado numa etapa e "João" escolhido
// do CRM em outra continuam sendo a mesma mudança. O deal só entra se não houver nome.
export function mudancaKey(p: Pick<Programacao, 'id' | 'deal_id' | 'cliente'>): string {
  if (p.cliente && p.cliente.trim()) return 'c:' + norm(p.cliente)
  if (p.deal_id) return 'd:' + p.deal_id
  return 'e:' + p.id
}

// ---------------------------------------------------------------------------
// Equipe: motoristas e ajudantes vêm do cadastro de colaboradores (pela função);
// chapas freelancer são só um nome digitado em cada mudança.
// ---------------------------------------------------------------------------
export type GrupoPessoa = 'motorista' | 'ajudante' | 'outro'

export const GRUPO_LABEL: Record<GrupoPessoa, string> = {
  motorista: 'Motoristas',
  ajudante: 'Ajudantes',
  outro: 'Outros',
}

export function grupoPessoa(funcao: string | null | undefined): GrupoPessoa {
  const f = norm(funcao ?? '')
  if (f.includes('motorista')) return 'motorista'
  if (f.includes('ajudante')) return 'ajudante'
  return 'outro'
}

// Acrescenta um chapa (sem repetir o mesmo nome, ignorando acento/caixa).
export function addChapa(lista: string[], nome: string): string[] {
  const n = nome.trim().replace(/\s+/g, ' ')
  if (!n || lista.some((x) => norm(x) === norm(n))) return lista
  return [...lista, n]
}

// Nomes de quem vai (equipe + chapas) para exibir numa etiqueta.
export function nomesEquipe(
  e: Pick<Programacao, 'equipe' | 'freelancers'>,
  labelPessoa: (id: string) => string,
): string[] {
  return [...e.equipe.map(labelPessoa), ...e.freelancers.map((n) => `${n} (chapa)`)]
}

// Chave de um cliente do CRM (mesma regra das etapas já programadas).
export function chaveCliente(nome: string): string {
  return 'c:' + norm(nome)
}

// ---------------------------------------------------------------------------
// Conflitos: mesmo caminhão ou mesma pessoa em duas mudanças diferentes no mesmo
// dia. Manutenção do caminhão conflita com qualquer outra atividade dele no dia.
// Cancelados são ignorados. Devolve id -> mensagens.
// ---------------------------------------------------------------------------
export function detectarConflitos(
  eventos: Programacao[],
  nomeCaminhao: (id: string) => string,
  nomePessoa: (id: string) => string,
): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const add = (id: string, msg: string) => {
    const cur = out.get(id) ?? []
    if (!cur.includes(msg)) cur.push(msg)
    out.set(id, cur)
  }
  const ativos = eventos.filter((e) => e.status !== 'cancelado')

  // Caminhão × dia
  const porCaminhao = new Map<string, Programacao[]>()
  for (const e of ativos) {
    if (!e.caminhao_id) continue
    const k = e.caminhao_id + '|' + e.data
    porCaminhao.set(k, [...(porCaminhao.get(k) ?? []), e])
  }
  for (const lista of porCaminhao.values()) {
    if (lista.length < 2) continue
    const keys = new Set(lista.map(mudancaKey))
    const temManut = lista.some((e) => e.tipo === 'manutencao')
    if (keys.size < 2 && !(temManut && lista.some((e) => e.tipo !== 'manutencao'))) continue
    const nome = nomeCaminhao(lista[0].caminhao_id as string)
    for (const e of lista) {
      add(
        e.id,
        temManut && e.tipo !== 'manutencao'
          ? `${nome} está em manutenção neste dia.`
          : `${nome} está em mais de uma mudança neste dia.`,
      )
    }
  }

  // Chapa freelancer × dia (pelo nome)
  const porChapa = new Map<string, { nome: string; lista: Programacao[] }>()
  for (const e of ativos) {
    for (const n of e.freelancers) {
      const k = norm(n) + '|' + e.data
      const cur = porChapa.get(k) ?? { nome: n, lista: [] }
      cur.lista.push(e)
      porChapa.set(k, cur)
    }
  }
  for (const { nome, lista } of porChapa.values()) {
    if (lista.length < 2 || new Set(lista.map(mudancaKey)).size < 2) continue
    for (const e of lista) add(e.id, `${nome} (chapa) está escalado(a) em mais de uma mudança neste dia.`)
  }

  // Pessoa × dia
  const porPessoa = new Map<string, Programacao[]>()
  for (const e of ativos) {
    for (const pid of e.equipe) {
      const k = pid + '|' + e.data
      porPessoa.set(k, [...(porPessoa.get(k) ?? []), e])
    }
  }
  for (const [k, lista] of porPessoa) {
    if (lista.length < 2) continue
    if (new Set(lista.map(mudancaKey)).size < 2) continue
    const nome = nomePessoa(k.split('|')[0])
    for (const e of lista) add(e.id, `${nome} está escalado(a) em mais de uma mudança neste dia.`)
  }
  return out
}

// ---------------------------------------------------------------------------
// Acesso ao banco
// ---------------------------------------------------------------------------
// Janela carregada: 60 dias atrás → futuro (histórico antigo não pesa na tela).
export async function fetchProgramacao(): Promise<Programacao[]> {
  const desde = addDays(new Date().toISOString().slice(0, 10), -60)
  const { data, error } = await supabase
    .from('programacao')
    .select(COLS)
    .gte('data', desde)
    .order('data', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as Programacao[]) ?? []
}

export async function fetchDealsProg(): Promise<DealProg[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('id, nome, origem, destino, parceiro, data_mudanca')
    .eq('stage', 'fechado')
    .order('data_mudanca', { ascending: false })
  if (error) throw error
  return (data as DealProg[]) ?? []
}

// Deals cujo processo ainda está em "Mudanças Fechadas" (candidatos a programar).
export async function fetchDealIdsFechadas(): Promise<string[]> {
  const { data, error } = await supabase.from('processos').select('deal_id').eq('status', 'fechadas')
  if (error) throw error
  return ((data as { deal_id: string }[]) ?? []).map((r) => r.deal_id)
}

export type NewProgramacao = Omit<Programacao, 'id' | 'created_at' | 'updated_at'>

export async function insertProgramacao(rows: NewProgramacao[]): Promise<Programacao[]> {
  const { data, error } = await supabase.from('programacao').insert(rows).select(COLS)
  if (error) throw error
  return (data as Programacao[]) ?? []
}

export async function updateProgramacao(id: string, patch: Partial<Programacao>): Promise<void> {
  const { error } = await supabase.from('programacao').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteProgramacao(ids: string[]): Promise<void> {
  const { error } = await supabase.from('programacao').delete().in('id', ids)
  if (error) throw error
}
