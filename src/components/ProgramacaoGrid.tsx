import { useMemo } from 'react'
import { fmtDay } from '../lib/format'
import { addDays, toYMD } from '../lib/prazos'
import { TIPOS } from '../lib/programacao'
import type { Programacao } from '../lib/types'
import { Icon } from './Icon'

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export interface LinhaGrade {
  key: string
  titulo: string
  sub?: string
  vazio?: string // texto quando a linha não tem nada na janela
  match: (e: Programacao) => boolean
}

// Grade: linhas (caminhões / equipe) × dias. Clicar numa célula vazia cria uma
// atividade naquele dia/linha; clicar numa etiqueta abre para editar.
export function ProgramacaoGrid({
  eventos,
  linhas,
  inicio,
  dias,
  conflitos,
  meta,
  labelCaminhao,
  labelPessoa,
  onNovo,
  onAbrir,
}: {
  eventos: Programacao[]
  linhas: LinhaGrade[]
  inicio: string // YYYY-MM-DD do 1º dia
  dias: number
  conflitos: Map<string, string[]>
  meta: 'caminhao' | 'equipe' // 2ª informação na etiqueta: 'equipe' (linhas = caminhões) ou 'caminhao' (linhas = pessoas)
  labelCaminhao: (id: string) => string
  labelPessoa: (id: string) => string
  onNovo: (data: string, linha: LinhaGrade) => void
  onAbrir: (e: Programacao) => void
}) {
  const hoje = toYMD(new Date())
  const colunas = useMemo(() => Array.from({ length: dias }, (_, i) => addDays(inicio, i)), [inicio, dias])
  const fim = colunas[colunas.length - 1]

  // Eventos da janela, indexados por (linha, dia).
  const porCelula = useMemo(() => {
    const m = new Map<string, Programacao[]>()
    for (const e of eventos) {
      if (e.data < inicio || e.data > fim) continue
      for (const l of linhas) {
        if (!l.match(e)) continue
        const k = l.key + '|' + e.data
        m.set(k, [...(m.get(k) ?? []), e])
      }
    }
    return m
  }, [eventos, linhas, inicio, fim])

  const colW = dias <= 7 ? 'min-w-[132px]' : 'min-w-[118px]'

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[150px] border-b border-r border-border bg-card px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-2">
              {meta === 'equipe' ? 'Caminhão' : 'Pessoa'}
            </th>
            {colunas.map((d) => {
              const dt = new Date(d + 'T00:00:00')
              const dow = dt.getDay()
              const isHoje = d === hoje
              return (
                <th
                  key={d}
                  className={
                    colW +
                    ' border-b border-border px-2 py-2 text-center font-semibold ' +
                    (dow === 0 || dow === 6 ? 'bg-[#F9FAFB]' : 'bg-card')
                  }
                >
                  <div className="text-[10.5px] uppercase tracking-wide text-muted-2">{DOW[dow]}</div>
                  <div
                    className={
                      'mx-auto mt-0.5 inline-grid h-6 min-w-[26px] place-items-center rounded-full px-1.5 text-[12px] ' +
                      (isHoje ? 'bg-primary text-white' : 'text-text')
                    }
                  >
                    {fmtDay(d)}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.key}>
              <th className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 text-left align-top">
                <div className="text-[13px] font-semibold leading-tight">{l.titulo}</div>
                {l.sub && <div className="mt-0.5 text-[11px] font-normal text-muted-2">{l.sub}</div>}
              </th>
              {colunas.map((d) => {
                const dow = new Date(d + 'T00:00:00').getDay()
                const lista = porCelula.get(l.key + '|' + d) ?? []
                return (
                  <td
                    key={d}
                    onClick={() => onNovo(d, l)}
                    title="Clique para programar neste dia"
                    className={
                      'group h-[76px] cursor-pointer border-b border-border p-1 align-top transition-colors hover:bg-[#F5F8FF] ' +
                      (dow === 0 || dow === 6 ? 'bg-[#F9FAFB]' : '') +
                      (d === hoje ? ' bg-[#F5F8FF]' : '')
                    }
                  >
                    <div className="flex flex-col gap-1">
                      {lista.map((e) => (
                        <Chip
                          key={e.id}
                          e={e}
                          meta={meta}
                          conflito={conflitos.get(e.id)}
                          labelCaminhao={labelCaminhao}
                          labelPessoa={labelPessoa}
                          onClick={() => onAbrir(e)}
                        />
                      ))}
                      {lista.length === 0 && (
                        <span className="grid h-[60px] place-items-center text-muted-2 opacity-0 group-hover:opacity-100">
                          <Icon name="plus" className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Chip({
  e,
  meta,
  conflito,
  labelCaminhao,
  labelPessoa,
  onClick,
}: {
  e: Programacao
  meta: 'caminhao' | 'equipe'
  conflito?: string[]
  labelCaminhao: (id: string) => string
  labelPessoa: (id: string) => string
  onClick: () => void
}) {
  const t = TIPOS[e.tipo]
  const cancelado = e.status === 'cancelado'
  const segunda =
    meta === 'equipe'
      ? e.equipe.length > 0
        ? e.equipe.map(labelPessoa).join(', ')
        : ''
      : e.terceiro
        ? 'Terceiro'
        : e.caminhao_id
          ? labelCaminhao(e.caminhao_id)
          : ''
  const tip = [
    `${t.label}${e.cliente ? ' · ' + e.cliente : ''}`,
    e.local,
    e.equipe.length ? 'Equipe: ' + e.equipe.map(labelPessoa).join(', ') : null,
    e.obs,
    ...(conflito ?? []).map((c) => '⚠ ' + c),
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <button
      onClick={(ev) => {
        ev.stopPropagation()
        onClick()
      }}
      title={tip}
      style={{
        background: t.bg,
        color: t.fg,
        borderColor: conflito ? '#EF4444' : t.border,
      }}
      className={
        'w-full rounded-md border px-1.5 py-1 text-left leading-tight shadow-sm hover:brightness-95 ' +
        (conflito ? 'ring-1 ring-[#EF4444] ' : '') +
        (cancelado ? 'opacity-50 ' : '')
      }
    >
      <div className="flex items-center gap-1">
        {e.status === 'feito' && <Icon name="check" className="h-3 w-3 flex-none [stroke-width:3]" />}
        {conflito && <Icon name="alert" className="h-3 w-3 flex-none text-[#b91c1c]" />}
        <span className={'truncate text-[11px] font-semibold ' + (cancelado ? 'line-through' : '')}>
          {t.label}
        </span>
      </div>
      {e.cliente && <div className="truncate text-[11px] font-medium text-text">{e.cliente}</div>}
      {(e.local || segunda) && (
        <div className="truncate text-[10px] opacity-80">{[e.local, segunda].filter(Boolean).join(' · ')}</div>
      )}
    </button>
  )
}
