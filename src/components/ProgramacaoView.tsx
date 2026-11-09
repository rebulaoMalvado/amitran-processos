import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { nomeCaminhao, nomePessoa, useProgramacao } from '../hooks/useProgramacao'
import { fmtDay } from '../lib/format'
import { addDays, toYMD } from '../lib/prazos'
import type { DealProg, Programacao } from '../lib/types'
import { Icon } from './Icon'
import { ProgramacaoDrawer } from './ProgramacaoDrawer'
import { ProgramacaoGrid, type LinhaGrade } from './ProgramacaoGrid'
import { ProgramacaoPorMudanca } from './ProgramacaoPorMudanca'
import { RoteiroDrawer } from './RoteiroDrawer'
import { grupoPessoa, GRUPO_LABEL, norm, TIPOS } from '../lib/programacao'
import { useToast } from './Toast'

type Aba = 'caminhoes' | 'equipe' | 'mudancas'

// Segunda-feira da semana de uma data.
function segunda(ymd: string): string {
  const dow = new Date(ymd + 'T00:00:00').getDay()
  return addDays(ymd, dow === 0 ? -6 : 1 - dow)
}

export function ProgramacaoView({
  dealParaProgramar = null,
  onDealConsumido,
}: {
  dealParaProgramar?: string | null // vindo do botão "Programar" do Processos
  onDealConsumido?: () => void
}) {
  const { session } = useAuth()
  const toast = useToast()
  const prog = useProgramacao(session?.user.id ?? null, toast)
  const { eventos, caminhoes, pessoas, deals, aProgramar, conflitos, labelCaminhao, labelPessoa } = prog

  const [aba, setAba] = useState<Aba>('caminhoes')
  const [dias, setDias] = useState<7 | 14>(7)
  const [inicio, setInicio] = useState(() => segunda(toYMD(new Date())))
  const [drawer, setDrawer] = useState<
    { evento: Programacao | null; inicial?: Partial<Programacao> } | null
  >(null)
  // false = fechado; { deal } = aberto (deal null = em branco)
  const [roteiro, setRoteiro] = useState<false | { deal: DealProg | null }>(false)
  const [verTodas, setVerTodas] = useState(false)

  // Chegou do Processos com um deal escolhido: abre o roteiro já preenchido
  // (ou, se essa mudança já foi programada, vai direto para a linha do tempo dela).
  useEffect(() => {
    if (!dealParaProgramar || prog.loading) return
    const d = deals.find((x) => x.id === dealParaProgramar)
    if (d) {
      if (aProgramar.some((x) => x.id === d.id)) setRoteiro({ deal: d })
      else {
        setAba('mudancas')
        toast(`${d.nome} já tem programação — veja a linha do tempo.`)
      }
    }
    onDealConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealParaProgramar, prog.loading])

  const hoje = toYMD(new Date())
  const fim = addDays(inicio, dias - 1)

  // ---- linhas da grade ----
  const linhasCaminhao = useMemo<LinhaGrade[]>(() => {
    const ativos = new Set(caminhoes.map((c) => c.id))
    const l: LinhaGrade[] = caminhoes.map((c) => ({
      key: c.id,
      titulo: nomeCaminhao(c),
      sub: c.apelido?.trim() ? `${c.placa}${c.modelo ? ' · ' + c.modelo : ''}` : (c.modelo ?? undefined),
      match: (e) => e.caminhao_id === c.id,
    }))
    l.push({ key: '__terceiro', titulo: 'Terceiros', sub: 'parceiros', match: (e) => e.terceiro })
    l.push({
      key: '__sem',
      titulo: 'Sem caminhão',
      sub: 'embalagem, equipe',
      match: (e) => !e.caminhao_id && !e.terceiro,
    })
    // Eventos que apontam para caminhão inativo/removido não podem sumir da tela.
    if (eventos.some((e) => e.caminhao_id && !ativos.has(e.caminhao_id)))
      l.push({
        key: '__inativo',
        titulo: 'Caminhão inativo',
        sub: 'fora da frota ativa',
        match: (e) => !!e.caminhao_id && !ativos.has(e.caminhao_id),
      })
    return l
  }, [caminhoes, eventos])

  // Equipe: motoristas, ajudantes e, por último, um chapa por linha (só os que
  // aparecem na janela exibida) — mais "Sem equipe definida".
  const linhasEquipe = useMemo<LinhaGrade[]>(() => {
    const l: LinhaGrade[] = pessoas.map((p) => ({
      key: p.id,
      titulo: nomePessoa(p),
      sub: GRUPO_LABEL[grupoPessoa(p.funcao)].replace(/s$/, ''),
      match: (e) => e.equipe.includes(p.id),
    }))
    const chapas = new Map<string, string>()
    for (const e of eventos) {
      if (e.data < inicio || e.data > fim) continue
      for (const n of e.freelancers) if (!chapas.has(norm(n))) chapas.set(norm(n), n)
    }
    for (const [k, nome] of [...chapas].sort((a, b) => a[1].localeCompare(b[1]))) {
      l.push({
        key: 'f:' + k,
        titulo: nome,
        sub: 'chapa freelancer',
        freela: nome,
        match: (e) => e.freelancers.some((n) => norm(n) === k),
      })
    }
    l.push({
      key: '__sem_equipe',
      titulo: 'Sem equipe definida',
      sub: 'definir quem vai',
      match: (e) => e.equipe.length === 0 && e.freelancers.length === 0,
    })
    return l
  }, [pessoas, eventos, inicio, fim])

  // ---- resumo da janela ----
  const naJanela = useMemo(
    () => eventos.filter((e) => e.data >= inicio && e.data <= fim && e.status !== 'cancelado'),
    [eventos, inicio, fim],
  )
  const conflitosJanela = useMemo(
    () =>
      naJanela
        .filter((e) => conflitos.has(e.id))
        .sort((a, b) => a.data.localeCompare(b.data)),
    [naJanela, conflitos],
  )
  const emUsoHoje = useMemo(() => {
    const ids = new Set(
      eventos.filter((e) => e.data === hoje && e.status !== 'cancelado' && e.caminhao_id).map((e) => e.caminhao_id),
    )
    return ids.size
  }, [eventos, hoje])

  // ---- ações ----
  function novo(data: string, linha: LinhaGrade) {
    const inicial: Partial<Programacao> = { data }
    if (aba === 'caminhoes') {
      if (linha.key === '__terceiro') inicial.terceiro = true
      else if (!linha.key.startsWith('__')) inicial.caminhao_id = linha.key
    } else if (linha.freela) {
      inicial.freelancers = [linha.freela]
    } else if (!linha.key.startsWith('__')) {
      inicial.equipe = [linha.key]
    }
    setDrawer({ evento: null, inicial })
  }

  function novaEtapaDe(ultima: Programacao) {
    setDrawer({
      evento: null,
      inicial: {
        data: addDays(ultima.data, 1),
        deal_id: ultima.deal_id,
        cliente: ultima.cliente,
        caminhao_id: ultima.caminhao_id,
        terceiro: ultima.terceiro,
        equipe: ultima.equipe,
        freelancers: ultima.freelancers,
        tipo: 'outro',
      },
    })
  }

  const tabBtn = (on: boolean) =>
    'px-3 py-2 text-[12.5px] font-medium ' + (on ? 'bg-primary text-white' : 'bg-card text-muted')

  const mostraGrade = aba !== 'mudancas'

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Programação</div>
          <div className="mt-px text-[12.5px] text-muted">
            {prog.loading ? 'Carregando…' : `Onde cada caminhão e cada pessoa está, dia a dia`}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex overflow-hidden rounded-[9px] border border-border-2">
          <button onClick={() => setAba('caminhoes')} className={tabBtn(aba === 'caminhoes')}>
            Caminhões
          </button>
          <button onClick={() => setAba('equipe')} className={tabBtn(aba === 'equipe') + ' border-l border-border-2'}>
            Equipe
          </button>
          <button onClick={() => setAba('mudancas')} className={tabBtn(aba === 'mudancas') + ' border-l border-border-2'}>
            Por mudança
          </button>
        </div>
        <button
          onClick={() => setDrawer({ evento: null, inicial: { data: hoje } })}
          className="flex items-center gap-1.5 rounded-[9px] border border-border-2 bg-card px-3.5 py-2.5 text-[13.5px] font-semibold text-muted shadow-sm hover:bg-[#F3F5F8]"
        >
          <Icon name="plus" className="h-4 w-4 [stroke-width:2.4]" />
          Atividade
        </button>
        <button
          onClick={() => setRoteiro({ deal: null })}
          className="flex items-center gap-1.5 rounded-[9px] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          <Icon name="route" className="h-4 w-4" />
          Programar mudança
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
        {prog.error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar a programação: {prog.error}
            <div className="mt-1 text-[12px] opacity-80">
              Se a tabela ainda não existe no banco, falta aplicar a migration create_programacao.
            </div>
          </div>
        ) : (
          <>
            {aProgramar.length > 0 && (
              <section className="mb-4 rounded-xl border border-[#F6E0A6] bg-[#FEF6E3] p-3.5">
                <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-[#92610a]">
                  <Icon name="alert" className="h-4 w-4" />
                  {aProgramar.length} {aProgramar.length === 1 ? 'mudança fechada ainda sem programação' : 'mudanças fechadas ainda sem programação'}
                  {aProgramar.length > 4 && (
                    <button
                      onClick={() => setVerTodas((v) => !v)}
                      className="ml-auto text-[12px] font-medium text-[#92610a] underline"
                    >
                      {verTodas ? 'mostrar menos' : `ver todas (${aProgramar.length})`}
                    </button>
                  )}
                </div>
                <div className={verTodas ? 'flex flex-wrap gap-2' : 'flex gap-2 overflow-x-auto pb-1'}>
                  {(verTodas ? aProgramar : aProgramar.slice(0, 8)).map((d) => {
                    const passou = !!d.data_mudanca && d.data_mudanca < hoje
                    return (
                      <div
                        key={d.id}
                        className="flex w-[230px] flex-none flex-col rounded-[10px] border border-border bg-card p-3 shadow-sm"
                      >
                        <div className="truncate text-[13.5px] font-semibold">{d.nome}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
                          <Icon name="map" className="h-3 w-3 flex-none text-muted-2" />
                          <span className="truncate">{d.origem || '—'}</span>
                          <Icon name="arrow" className="h-3 w-3 flex-none text-muted-2" />
                          <span className="truncate">{d.destino || '—'}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                          <span className={passou ? 'font-semibold text-[#b91c1c]' : 'text-muted-2'}>
                            prev. {fmtDay(d.data_mudanca)}
                            {passou ? ' (já passou)' : ''}
                          </span>
                          <span className="text-muted-2">·</span>
                          <span className="truncate text-muted-2">
                            {d.parceiro?.trim() ? `Terceiro · ${d.parceiro}` : 'Frota própria'}
                          </span>
                        </div>
                        <button
                          onClick={() => setRoteiro({ deal: d })}
                          className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-[12.5px] font-semibold text-white hover:bg-primary-hover"
                        >
                          <Icon name="route" className="h-3.5 w-3.5" />
                          Programar
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {mostraGrade && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setInicio(addDays(inicio, -dias))}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border-2 bg-card text-muted hover:bg-[#F3F5F8]"
                    >
                      <Icon name="arrow" className="h-4 w-4 rotate-180" />
                    </button>
                    <button
                      onClick={() => setInicio(addDays(inicio, dias))}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border-2 bg-card text-muted hover:bg-[#F3F5F8]"
                    >
                      <Icon name="arrow" className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setInicio(segunda(hoje))}
                      className="rounded-lg border border-border-2 bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-[#F3F5F8]"
                    >
                      Hoje
                    </button>
                  </div>
                  <div className="text-[14px] font-bold tracking-tight">
                    {fmtDay(inicio)} → {fmtDay(fim)}
                  </div>
                  <div className="ml-auto flex overflow-hidden rounded-[9px] border border-border-2">
                    <button onClick={() => setDias(7)} className={tabBtn(dias === 7)}>
                      Semana
                    </button>
                    <button onClick={() => setDias(14)} className={tabBtn(dias === 14) + ' border-l border-border-2'}>
                      2 semanas
                    </button>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Resumo k="Atividades na janela" v={String(naJanela.length)} />
                  <Resumo k="Caminhões na rua hoje" v={`${emUsoHoje} de ${caminhoes.length}`} />
                  <Resumo k="Conflitos" v={String(conflitosJanela.length)} alerta={conflitosJanela.length > 0} />
                </div>

                {conflitosJanela.length > 0 && (
                  <div className="mb-3 rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] px-4 py-3 text-[12.5px] text-[#b91c1c]">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold">
                      <Icon name="alert" className="h-[14px] w-[14px]" />
                      Conflitos nesta janela
                    </div>
                    {conflitosJanela.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setDrawer({ evento: e })}
                        className="block w-full text-left hover:underline"
                      >
                        {fmtDay(e.data)} · {TIPOS[e.tipo].label}
                        {e.cliente ? ` · ${e.cliente}` : ''} — {conflitos.get(e.id)?.[0]}
                      </button>
                    ))}
                  </div>
                )}

                <ProgramacaoGrid
                  eventos={eventos}
                  linhas={aba === 'caminhoes' ? linhasCaminhao : linhasEquipe}
                  inicio={inicio}
                  dias={dias}
                  conflitos={conflitos}
                  meta={aba === 'caminhoes' ? 'equipe' : 'caminhao'}
                  labelCaminhao={labelCaminhao}
                  labelPessoa={labelPessoa}
                  onNovo={novo}
                  onAbrir={(e) => setDrawer({ evento: e })}
                />
                <Legenda />
              </>
            )}

            {aba === 'mudancas' && (
              <ProgramacaoPorMudanca
                eventos={eventos}
                conflitos={conflitos}
                labelCaminhao={labelCaminhao}
                labelPessoa={labelPessoa}
                onAbrir={(e) => setDrawer({ evento: e })}
                onNovaEtapa={novaEtapaDe}
              />
            )}
          </>
        )}
      </div>

      {drawer && (
        <ProgramacaoDrawer
          key={drawer.evento?.id ?? 'novo'}
          evento={drawer.evento}
          inicial={drawer.inicial}
          eventos={eventos}
          deals={deals}
          caminhoes={caminhoes}
          pessoas={pessoas}
          labelCaminhao={labelCaminhao}
          labelPessoa={labelPessoa}
          onClose={() => setDrawer(null)}
          onSave={async (row) => {
            const ev = drawer.evento
            const ok = ev ? await prog.edit(ev.id, row) : await prog.add([row])
            if (ok) {
              toast(ev ? 'Atividade atualizada.' : 'Atividade programada.')
              setDrawer(null)
            }
          }}
          onDelete={
            drawer.evento
              ? async () => {
                  await prog.remove([drawer.evento!.id])
                  toast('Atividade excluída.')
                  setDrawer(null)
                }
              : undefined
          }
        />
      )}

      {roteiro && (
        <RoteiroDrawer
          key={roteiro.deal?.id ?? 'novo'}
          dealInicial={roteiro.deal}
          eventos={eventos}
          deals={deals}
          caminhoes={caminhoes}
          pessoas={pessoas}
          labelCaminhao={labelCaminhao}
          labelPessoa={labelPessoa}
          onClose={() => setRoteiro(false)}
          onSave={async (rows) => {
            const ok = await prog.add(rows)
            if (ok) {
              toast(`${rows.length} ${rows.length === 1 ? 'dia programado' : 'dias programados'}.`)
              setRoteiro(false)
              // Leva a janela para o 1º dia da mudança recém-criada.
              const primeiro = rows.map((r) => r.data).sort()[0]
              if (primeiro) setInicio(segunda(primeiro))
            }
          }}
        />
      )}
    </main>
  )
}

function Resumo({ k, v, alerta }: { k: string; v: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="text-[11.5px] font-medium text-muted">{k}</div>
      <div className={'mt-0.5 text-[20px] font-bold tracking-tight ' + (alerta ? 'text-[#b91c1c]' : '')}>{v}</div>
    </div>
  )
}

function Legenda() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
      {Object.values(TIPOS).map((t) => (
        <span key={t.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border" style={{ background: t.bg, borderColor: t.fg }} />
          {t.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <Icon name="check" className="h-3 w-3 [stroke-width:3]" /> feito
      </span>
      <span className="inline-flex items-center gap-1.5 text-[#b91c1c]">
        <Icon name="alert" className="h-3 w-3" /> conflito
      </span>
    </div>
  )
}
