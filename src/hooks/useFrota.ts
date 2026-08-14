import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteCaminhao,
  deleteManutencao,
  fetchCaminhoes,
  fetchManutencoes,
  insertCaminhao,
  insertManutencao,
  updateCaminhao,
} from '../lib/frota'
import type { Caminhao, Manutencao } from '../lib/types'

export interface CaminhaoForm {
  placa: string
  modelo: string
  apelido: string
  ano: string
}

export interface ManutencaoForm {
  descricao: string
  data: string
  valor: number
  obs: string
}

export interface UseFrota {
  caminhoes: Caminhao[]
  manutencoes: Manutencao[]
  loading: boolean
  error: string | null
  reload: () => void
  addCaminhao: (f: CaminhaoForm) => Promise<void>
  editCaminhao: (id: string, f: CaminhaoForm) => Promise<void>
  removeCaminhao: (id: string) => Promise<void>
  addManutencao: (caminhaoId: string, f: ManutencaoForm) => Promise<void>
  removeManutencao: (id: string) => Promise<void>
}

export function useFrota(currentUserId: string | null, onToast: (m: string) => void): UseFrota {
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    Promise.all([fetchCaminhoes(), fetchManutencoes()])
      .then(([c, m]) => {
        setCaminhoes(c)
        setManutencoes(m)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  const addCaminhao = useCallback(
    async (f: CaminhaoForm) => {
      try {
        const created = await insertCaminhao({
          placa: f.placa.trim(),
          modelo: f.modelo.trim() || null,
          apelido: f.apelido.trim() || null,
          ano: f.ano.trim() ? Number(f.ano) : null,
          created_by: currentUserId,
        })
        setCaminhoes((prev) => [...prev, created])
      } catch (e) {
        onToast('Erro ao salvar o caminhão.')
        console.error(e)
        reload()
      }
    },
    [currentUserId, onToast, reload],
  )

  const editCaminhao = useCallback(
    async (id: string, f: CaminhaoForm) => {
      const patch = {
        placa: f.placa.trim(),
        modelo: f.modelo.trim() || null,
        apelido: f.apelido.trim() || null,
        ano: f.ano.trim() ? Number(f.ano) : null,
      }
      setCaminhoes((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      try {
        await updateCaminhao(id, patch)
      } catch (e) {
        onToast('Erro ao atualizar — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  const removeCaminhao = useCallback(
    async (id: string) => {
      setCaminhoes((prev) => prev.filter((c) => c.id !== id))
      setManutencoes((prev) => prev.filter((m) => m.caminhao_id !== id))
      try {
        await deleteCaminhao(id)
      } catch (e) {
        onToast('Erro ao excluir — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  const addManutencao = useCallback(
    async (caminhaoId: string, f: ManutencaoForm) => {
      try {
        const created = await insertManutencao({
          caminhao_id: caminhaoId,
          descricao: f.descricao.trim(),
          data: f.data,
          valor: f.valor,
          obs: f.obs.trim() || null,
          created_by: currentUserId,
        })
        setManutencoes((prev) => [created, ...prev])
      } catch (e) {
        onToast('Erro ao salvar a manutenção.')
        console.error(e)
        reload()
      }
    },
    [currentUserId, onToast, reload],
  )

  const removeManutencao = useCallback(
    async (id: string) => {
      setManutencoes((prev) => prev.filter((m) => m.id !== id))
      try {
        await deleteManutencao(id)
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
      caminhoes,
      manutencoes,
      loading,
      error,
      reload,
      addCaminhao,
      editCaminhao,
      removeCaminhao,
      addManutencao,
      removeManutencao,
    }),
    [caminhoes, manutencoes, loading, error, reload, addCaminhao, editCaminhao, removeCaminhao, addManutencao, removeManutencao],
  )
}
