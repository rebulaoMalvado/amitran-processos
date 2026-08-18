import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { brl } from '../lib/format'
import {
  deleteColaborador,
  fetchColaboradores,
  insertColaborador,
  updateColaborador,
} from '../lib/colaboradores'
import type { Colaborador } from '../lib/types'
import { Icon } from './Icon'
import { useToast } from './Toast'

const inputCls =
  'w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak'

export function ColaboradoresView() {
  const { session } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<{ open: boolean; c: Colaborador | null }>({ open: false, c: null })

  function reload() {
    setLoading(true)
    fetchColaboradores()
      .then((l) => {
        setLista(l)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  const totalFolha = useMemo(
    () => lista.filter((c) => c.ativo).reduce((s, c) => s + Number(c.salario_base), 0),
    [lista],
  )

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Colaboradores</div>
          <div className="mt-px text-[12.5px] text-muted">
            {loading ? 'Carregando…' : `${lista.length} colaboradores · folha base ${brl(totalFolha)}`}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setDrawer({ open: true, c: null })}
          className="flex items-center gap-1.5 rounded-[9px] bg-primary px-3.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          <Icon name="plus" className="h-4 w-4 [stroke-width:2.4]" />
          Novo colaborador
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
        {error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar: {error}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-2">
                  <th className="px-4 py-2.5 font-semibold">Nome</th>
                  <th className="px-4 py-2.5 font-semibold">Função</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Salário base</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Plano saúde</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Alimentação</th>
                  <th className="px-4 py-2.5 text-right font-semibold">VT</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-muted-2">
                      {loading ? 'Carregando…' : 'Nenhum colaborador. Clique em “Novo colaborador”.'}
                    </td>
                  </tr>
                ) : (
                  lista.map((c) => (
                    <tr key={c.id} className={'border-b border-border last:border-0 hover:bg-[#F9FAFB] ' + (c.ativo ? '' : 'opacity-50')}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-[11.5px] text-muted-2">
                          {c.codigo ? `#${c.codigo}` : ''}
                          {c.apelido ? ` · ${c.apelido}` : ''}
                          {!c.ativo ? ' · inativo' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{c.funcao || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{brl(Number(c.salario_base))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{brl(Number(c.plano_saude))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{brl(Number(c.alimentacao))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{brl(Number(c.vale_transporte))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDrawer({ open: true, c })}
                            title="Editar"
                            className="grid h-7 w-7 place-items-center rounded-md border border-border-2 bg-card text-muted hover:bg-[#F3F5F8]"
                          >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Excluir ${c.nome}?`))
                                deleteColaborador(c.id).then(reload).catch((e) => { toast('Erro ao excluir.'); console.error(e) })
                            }}
                            title="Excluir"
                            className="grid h-7 w-7 place-items-center rounded-md border border-border-2 bg-card text-muted hover:border-[#F6D3D0] hover:bg-[#FCEBEA] hover:text-[#b91c1c]"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer.open && (
        <ColaboradorDrawer
          colaborador={drawer.c}
          onClose={() => setDrawer({ open: false, c: null })}
          onSaved={() => {
            setDrawer({ open: false, c: null })
            reload()
          }}
          userId={session?.user.id ?? null}
          onError={(m) => toast(m)}
        />
      )}
    </main>
  )
}

function num(v: string): number {
  const s = String(v).trim()
  if (!s) return 0
  // Se tem vírgula, é formato BR (1.806,97); senão, ponto decimal (1806.97).
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)
  return isNaN(n) ? 0 : n
}

function ColaboradorDrawer({
  colaborador,
  onClose,
  onSaved,
  userId,
  onError,
}: {
  colaborador: Colaborador | null
  onClose: () => void
  onSaved: () => void
  userId: string | null
  onError: (m: string) => void
}) {
  const [nome, setNome] = useState(colaborador?.nome ?? '')
  const [apelido, setApelido] = useState(colaborador?.apelido ?? '')
  const [codigo, setCodigo] = useState(colaborador?.codigo ?? '')
  const [funcao, setFuncao] = useState(colaborador?.funcao ?? '')
  const [salario, setSalario] = useState(colaborador ? String(colaborador.salario_base) : '')
  const [admissao, setAdmissao] = useState(colaborador?.admissao ?? '')
  const [plano, setPlano] = useState(colaborador ? String(colaborador.plano_saude) : '')
  const [alim, setAlim] = useState(colaborador ? String(colaborador.alimentacao) : '')
  const [vt, setVt] = useState(colaborador ? String(colaborador.vale_transporte) : '')
  const [ativo, setAtivo] = useState(colaborador?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!nome.trim()) return setErro('Informe o nome.')
    const payload = {
      nome: nome.trim(),
      apelido: apelido.trim() || null,
      codigo: codigo.trim() || null,
      funcao: funcao.trim() || null,
      salario_base: num(salario),
      admissao: admissao || null,
      plano_saude: num(plano),
      alimentacao: num(alim),
      vale_transporte: num(vt),
      ativo,
    }
    try {
      if (colaborador) await updateColaborador(colaborador.id, payload)
      else await insertColaborador({ ...payload, created_by: userId })
      onSaved()
    } catch (e) {
      onError('Erro ao salvar o colaborador.')
      console.error(e)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]" />
      <aside className="fixed right-0 top-0 z-[80] flex h-screen w-[min(440px,96vw)] flex-col border-l border-border bg-card shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="text-[17px] font-bold tracking-tight">{colaborador ? 'Editar colaborador' : 'Novo colaborador'}</div>
          <button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Field label="Nome *"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Apelido (folha de ponto)"><input className={inputCls} value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Elmar" /></Field>
            <Field label="Código"><input className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} /></Field>
          </div>
          <Field label="Função"><input className={inputCls} value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="MOTORISTA / AJUDANTE…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Salário base (R$)"><input className={inputCls} value={salario} onChange={(e) => setSalario(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Admissão"><input type="date" className={inputCls} value={admissao} onChange={(e) => setAdmissao(e.target.value)} /></Field>
          </div>
          <div className="mb-1.5 mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-2">Descontos fixos mensais</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Plano saúde"><input className={inputCls} value={plano} onChange={(e) => setPlano(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Alimentação"><input className={inputCls} value={alim} onChange={(e) => setAlim(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Vale transporte"><input className={inputCls} value={vt} onChange={(e) => setVt(e.target.value)} inputMode="decimal" /></Field>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
          {erro && <div className="mt-2 text-[12.5px] font-medium text-[#b91c1c]">{erro}</div>}
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-3.5">
          <button onClick={onClose} className="flex-1 rounded-[9px] border border-border-2 bg-card py-2.5 text-[13.5px] font-semibold text-muted hover:bg-[#F3F5F8]">Cancelar</button>
          <button onClick={salvar} className="flex-1 rounded-[9px] bg-primary py-2.5 text-[13.5px] font-semibold text-white hover:bg-primary-hover">{colaborador ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </aside>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-[12.5px] text-muted">{label}</div>
      {children}
    </div>
  )
}
