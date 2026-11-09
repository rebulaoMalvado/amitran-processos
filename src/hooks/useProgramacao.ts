import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCaminhoes } from '../lib/frota'
import { fetchColaboradores } from '../lib/colaboradores'
import {
  deleteProgramacao,
  detectarConflitos,
  fetchDealsProg,
  fetchProgramacao,
  insertProgramacao,
  updateProgramacao,
  type NewProgramacao,
} from '../lib/programacao'
import type { Caminhao, Colaborador, DealProg, Programacao } from '../lib/types'

export function nomeCaminhao(c: Caminhao): string {
  return c.apelido?.trim() || c.placa
}

export function nomePessoa(c: Colaborador): string {
  return c.apelido?.trim() || c.nome.trim().split(/\s+/)[0]
}

export interface UseProgramacao {
  eventos: Programacao[]
  caminhoes: Caminhao[] // só ativos
  pessoas: Colaborador[] // só ativos
  deals: DealProg[]
  conflitos: Map<string, string[]>
  labelCaminhao: (id: string) => string
  labelPessoa: (id: string) => string
  loading: boolean
  error: string | null
  reload: () => void
  add: (rows: Omit<NewProgramacao, 'created_by'>[]) => Promise<boolean>
  edit: (id: string, patch: Partial<Programacao>) => Promise<boolean>
  remove: (ids: string[]) => Promise<void>
}

export function useProgramacao(
  currentUserId: string | null,
  onToast: (m: string) => void,
): UseProgramacao {
  const [eventos, setEventos] = useState<Programacao[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [pessoas, setPessoas] = useState<Colaborador[]>([])
  const [todasPessoas, setTodasPessoas] = useState<Colaborador[]>([])
  const [todosCaminhoes, setTodosCaminhoes] = useState<Caminhao[]>([])
  const [deals, setDeals] = useState<DealProg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    Promise.all([fetchProgramacao(), fetchCaminhoes(), fetchColaboradores(), fetchDealsProg()])
      .then(([p, c, col, d]) => {
        setEventos(p)
        setTodosCaminhoes(c)
        setCaminhoes(c.filter((x) => x.ativo))
        setTodasPessoas(col)
        setPessoas(col.filter((x) => x.ativo))
        setDeals(d)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  // Nomes resolvem também para inativos/removidos (um evento antigo ainda os cita).
  const labelCaminhao = useCallback(
    (id: string) => {
      const c = todosCaminhoes.find((x) => x.id === id)
      return c ? nomeCaminhao(c) : 'Caminhão removido'
    },
    [todosCaminhoes],
  )
  const labelPessoa = useCallback(
    (id: string) => {
      const c = todasPessoas.find((x) => x.id === id)
      return c ? nomePessoa(c) : 'Ex-colaborador'
    },
    [todasPessoas],
  )

  const conflitos = useMemo(
    () => detectarConflitos(eventos, labelCaminhao, labelPessoa),
    [eventos, labelCaminhao, labelPessoa],
  )

  const add = useCallback(
    async (rows: Omit<NewProgramacao, 'created_by'>[]) => {
      try {
        const created = await insertProgramacao(rows.map((r) => ({ ...r, created_by: currentUserId })))
        setEventos((prev) =>
          [...prev, ...created].sort(
            (a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at),
          ),
        )
        return true
      } catch (e) {
        onToast('Erro ao salvar a programação.')
        console.error(e)
        reload()
        return false
      }
    },
    [currentUserId, onToast, reload],
  )

  const edit = useCallback(
    async (id: string, patch: Partial<Programacao>) => {
      setEventos((prev) =>
        prev
          .map((e) => (e.id === id ? { ...e, ...patch } : e))
          .sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at)),
      )
      try {
        await updateProgramacao(id, patch)
        return true
      } catch (e) {
        onToast('Erro ao atualizar — recarregando.')
        console.error(e)
        reload()
        return false
      }
    },
    [onToast, reload],
  )

  const remove = useCallback(
    async (ids: string[]) => {
      setEventos((prev) => prev.filter((e) => !ids.includes(e.id)))
      try {
        await deleteProgramacao(ids)
      } catch (e) {
        onToast('Erro ao excluir — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  return useMemo(
    () => ({
      eventos,
      caminhoes,
      pessoas,
      deals,
      conflitos,
      labelCaminhao,
      labelPessoa,
      loading,
      error,
      reload,
      add,
      edit,
      remove,
    }),
    [eventos, caminhoes, pessoas, deals, conflitos, labelCaminhao, labelPessoa, loading, error, reload, add, edit, remove],
  )
}
