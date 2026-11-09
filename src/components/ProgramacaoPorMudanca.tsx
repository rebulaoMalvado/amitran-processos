import { useMemo, useState } from 'react'
import { fmtDay } from '../lib/format'
import { toYMD } from '../lib/prazos'
import { mudancaKey, TIPOS } from '../lib/programacao'
import type { Programacao } from '../lib/types'
import { Icon } from './Icon'

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

interface Grupo {
  key: string
  cliente: string
  eventos: Programacao[] // ordenados por data
  primeiro: string
  ultimo: string
  feitos: number
  total: number
  concluida: boolean
}

// Linha do tempo por mudança: "07 embalagem → 08 coleta → 09 viagem → …".
export function ProgramacaoPorMudanca({
  eventos,
  conflitos,
  labelCaminhao,
  labelPessoa,
  onAbrir,
  onNovaEtapa,
}: {
  eventos: Programacao[]
  conflitos: Map<string, string[]>
  labelCaminhao: (id: string) => string
  labelPessoa: (id: string) => string
  onAbrir: (e: Programacao) => void
  onNovaEtapa: (ultima: Programacao) => void
}) {
  const hoje = toYMD(new Date())
  const [aba, setAba] = useState<'andamento' | 'concluidas'>('andamento')

  const grupos = useMemo(() => {
    const m = new Map<string, Programacao[]>()
    for (const e of eventos) {
      // Atividade sem cliente (ex.: manutenção do caminhão) não é uma "mudança".
      if (!e.cliente?.trim() && !e.deal_id) continue
      m.set(mudancaKey(e), [...(m.get(mudancaKey(e)) ?? []), e])
    }
    const out: Grupo[] = []
    for (const [key, lista] of m) {
      const ev = [...lista].sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at))
      const validos = ev.filter((e) => e.status !== 'cancelado')
      const feitos = validos.filter((e) => e.status === 'feito').length
      const ultimo = ev[ev.length - 1].data
      // Concluída = nada pendente (tudo feito/cancelado) ou tudo já passou e foi feito.
      const concluida = validos.length === 0 || validos.every((e) => e.status === 'feito')
      out.push({
        key,
        cliente: ev.find((e) => e.cliente)?.cliente ?? 'Sem cliente',
        eventos: ev,
        primeiro: ev[0].data,
        ultimo,
        feitos,
        total: validos.length,
        concluida,
      })
    }
    return out
  }, [eventos])

  const andamento = grupos.filter((g) => !g.concluida).sort((a, b) => a.primeiro.localeCompare(b.primeiro))
  const concluidas = grupos.filter((g) => g.concluida).sort((a, b) => b.ultimo.localeCompare(a.ultimo))
  const lista = aba === 'andamento' ? andamento : concluidas

  return (
    <div>
      <div className="mb-3 flex w-fit overflow-hidden rounded-[9px] border border-border-2">
        <button
          onClick={() => setAba('andamento')}
          className={'px-3 py-2 text-[12.5px] font-medium ' + (aba === 'andamento' ? 'bg-primary text-white' : 'bg-card text-muted')}
        >
          Em andamento ({andamento.length})
        </button>
        <button
          onClick={() => setAba('concluidas')}
          className={'border-l border-border-2 px-3 py-2 text-[12.5px] font-medium ' + (aba === 'concluidas' ? 'bg-primary text-white' : 'bg-card text-muted')}
        >
          Concluídas ({concluidas.length})
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-2 p-8 text-center text-[13px] text-muted-2">
          {aba === 'andamento'
            ? 'Nenhuma mudança em andamento. Use "Programar mudança" para lançar uma.'
            : 'Nenhuma mudança concluída na janela carregada (últimos 60 dias).'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((g) => (
            <div key={g.key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <span className="text-[15px] font-bold tracking-tight">{g.cliente}</span>
                <span className="text-[12px] text-muted">
                  {fmtDay(g.primeiro)}
                  {g.ultimo !== g.primeiro ? ` → ${fmtDay(g.ultimo)}` : ''}
                </span>
                <span className="rounded-full border border-border bg-[#F3F5F8] px-2 py-px text-[11px] font-semibold text-muted">
                  {g.feitos}/{g.total} feitos
                </span>
                <button
                  onClick={() => onNovaEtapa(g.eventos[g.eventos.length - 1])}
                  className="ml-auto flex items-center gap-1 rounded-lg border border-border-2 bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-[#F3F5F8]"
                >
                  <Icon name="plus" className="h-3.5 w-3.5" />
                  etapa
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {g.eventos.map((e) => {
                  const t = TIPOS[e.tipo]
                  const dow = new Date(e.data + 'T00:00:00').getDay()
                  const c = conflitos.get(e.id)
                  const isHoje = e.data === hoje
                  const atrasado = e.status === 'previsto' && e.data < hoje
                  return (
                    <button
                      key={e.id}
                      onClick={() => onAbrir(e)}
                      title={c?.map((m) => '⚠ ' + m).join('\n')}
                      className={
                        'min-w-[150px] max-w-[190px] flex-1 rounded-[10px] border p-2.5 text-left hover:brightness-95 ' +
                        (e.status === 'cancelado' ? 'opacity-50' : '')
                      }
                      style={{ background: t.bg, borderColor: c ? '#EF4444' : t.border, color: t.fg }}
                    >
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        <span className={isHoje ? 'rounded bg-primary px-1 text-white' : ''}>
                          {DOW[dow]} {fmtDay(e.data)}
                        </span>
                        {e.status === 'feito' && <Icon name="check" className="h-3 w-3 [stroke-width:3]" />}
                        {c && <Icon name="alert" className="h-3 w-3 text-[#b91c1c]" />}
                        {atrasado && <span className="ml-auto text-[10px] text-[#b91c1c]">atrasado</span>}
                      </div>
                      <div className={'mt-1 text-[13px] font-bold ' + (e.status === 'cancelado' ? 'line-through' : '')}>
                        {t.label}
                      </div>
                      {e.local && <div className="truncate text-[11px] text-text">{e.local}</div>}
                      <div className="mt-1 flex items-center gap-1 text-[10.5px] opacity-80">
                        <Icon name="truck" className="h-3 w-3 flex-none" />
                        <span className="truncate">
                          {e.terceiro ? 'Terceiro' : e.caminhao_id ? labelCaminhao(e.caminhao_id) : '—'}
                        </span>
                      </div>
                      {e.equipe.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10.5px] opacity-80">
                          <Icon name="users" className="h-3 w-3 flex-none" />
                          <span className="truncate">{e.equipe.map(labelPessoa).join(', ')}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
