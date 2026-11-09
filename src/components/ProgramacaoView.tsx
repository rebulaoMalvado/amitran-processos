import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { nomeCaminhao, nomePessoa, useProgramacao, type UseProgramacao } from '../hooks/useProgramacao'
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

interface TelaProps {
  dealParaProgramar?: string | null // vindo do botão "Programar" do Processos
  onDealConsumido?: () => void
}

// Container: dados (hook) + sessão + avisos. A tela em si é `ProgramacaoTela`.
export function ProgramacaoView(props: TelaProps) {
  const { session } = useAuth()
  const toast = useToast()
  const prog = useProgramacao(session?.user.id ?? null, toast)
  return <ProgramacaoTela prog={prog} toast={toast} {...props} />
}

export function ProgramacaoTela({
  prog,
  toast,
  dealParaProgramar = null,
  onDealConsumido,
}: TelaProps & { prog: UseProgramacao; toast: (m: string) => void }) {
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
  const [verConflitos, setVerConflitos] = useState(false)

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

  // Faixa "sem programação": só o que ainda vai acontecer (previsão de hoje em diante
  // ou sem data). O que já passou não entra — não há o que programar.
  const pendentes = useMemo(
    () => aProgramar.filter((d) => !d.data_mudanca || d.data_mudanca >= hoje),
    [aProgramar, hoje],
  )

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

      <div
        className={
          'flex min-h-0 flex-1 flex-col px-6 pb-4 pt-4 ' + (mostraGrade ? 'overflow-hidden' : 'overflow-y-auto')
        }
      >
        {prog.error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar a programação: {prog.error}
            <div className="mt-1 text-[12px] opacity-80">
              Se a tabela ainda não existe no banco, falta aplicar a migration create_programacao.
            </div>
          </div>
        ) : (
          <>
            {pendentes.length > 0 && (
              <section className="mb-3 flex-none rounded-lg border border-[#F6E0A6] bg-[#FEF6E3] px-3 py-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-none items-center gap-1.5 whitespace-nowrap pt-1 text-[12.5px] font-semibold text-[#92610a]">
                    <Icon name="alert" className="h-4 w-4" />
                    {pendentes.length} sem programação
                  </div>
                  <div
                    className={
                      'flex min-w-0 flex-1 gap-1.5 ' +
                      (verTodas ? 'max-h-[120px] flex-wrap overflow-y-auto' : 'overflow-x-auto')
                    }
                  >
                    {(verTodas ? pendentes : pendentes.slice(0, 12)).map((d) => (
                      <div
                        key={d.id}
                        title={`${d.origem || '—'} → ${d.destino || '—'}`}
                        className="flex flex-none items-center gap-2 rounded-lg border border-border bg-card py-1 pl-2.5 pr-1 text-[12px] shadow-sm"
                      >
                        <span className="max-w-[160px] truncate font-semibold">{d.nome}</span>
                        <span className="text-muted-2">{fmtDay(d.data_mudanca)}</span>
                        {d.parceiro?.trim() && (
                          <span
                            title={`Terceiro · ${d.parceiro}`}
                            className="rounded bg-[#FEF6E3] px-1 text-[10px] font-semibold text-[#92610a]"
                          >
                            terc.
                          </span>
                        )}
                        <button
                          onClick={() => setRoteiro({ deal: d })}
                          className="rounded-md bg-primary px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-primary-hover"
                        >
                          Programar
                        </button>
                      </div>
                    ))}
                  </div>
                  {pendentes.length > 3 && (
                    <button
                      onClick={() => setVerTodas((v) => !v)}
                      className="flex-none whitespace-nowrap pt-1 text-[12px] font-medium text-[#92610a] underline"
                    >
                      {verTodas ? 'recolher' : 'ver todas'}
                    </button>
                  )}
                </div>
              </section>
            )}

            {mostraGrade && (
              <>
                <div className="mb-2.5 flex flex-none flex-wrap items-center gap-2">
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
                  <div className="ml-1 flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium">
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted">
                      {naJanela.length} atividades
                    </span>
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted">
                      {emUsoHoje}/{caminhoes.length} caminhões na rua hoje
                    </span>
                    {conflitosJanela.length > 0 && (
                      <button
                        onClick={() => setVerConflitos((v) => !v)}
                        className="flex items-center gap-1 rounded-full border border-[#F6D3D0] bg-[#FCEBEA] px-2.5 py-1 text-[#b91c1c] hover:brightness-95"
                      >
                        <Icon name="alert" className="h-3 w-3" />
                        {conflitosJanela.length} {conflitosJanela.length === 1 ? 'conflito' : 'conflitos'}
                        <span className="opacity-70">{verConflitos ? '▲' : '▼'}</span>
                      </button>
                    )}
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

                {conflitosJanela.length > 0 && verConflitos && (
                  <div className="mb-2.5 max-h-[96px] flex-none overflow-y-auto rounded-lg border border-[#F6D3D0] bg-[#FCEBEA] px-3 py-2 text-[12px] text-[#b91c1c]">
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

function Legenda() {
  return (
    <div className="mt-2 flex flex-none flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
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
