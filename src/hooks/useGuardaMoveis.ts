import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteLocacao,
  fetchBoxes,
  fetchLocacoes,
  fetchPagamentos,
  insertLocacao,
  updateBox,
  updateLocacao,
  upsertPagamento,
  type NewLocacao,
} from '../lib/gm'
import type { GmBox, GmLocacao, GmPagamento } from '../lib/types'

export interface UseGuardaMoveis {
  boxes: GmBox[]
  locacoes: GmLocacao[]
  pagamentos: GmPagamento[]
  loading: boolean
  error: string | null
  reload: () => void
  addLocacao: (row: Omit<NewLocacao, 'created_by'>) => Promise<void>
  editLocacao: (id: string, patch: Partial<GmLocacao>) => Promise<void>
  encerrarLocacao: (id: string, dataFim: string) => Promise<void>
  removeLocacao: (id: string) => Promise<void>
  editBox: (numero: number, patch: Partial<GmBox>) => Promise<void>
  marcarPago: (locacaoId: string, mesReferencia: string, valor: number) => Promise<void>
  desmarcarPago: (locacaoId: string, mesReferencia: string, valor: number) => Promise<void>
  setStatusMes: (
    locacaoId: string,
    mesReferencia: string,
    valor: number,
    status: 'pago' | 'isento' | 'aberto',
  ) => Promise<void>
}

export function useGuardaMoveis(
  currentUserId: string | null,
  onToast: (m: string) => void,
): UseGuardaMoveis {
  const [boxes, setBoxes] = useState<GmBox[]>([])
  const [locacoes, setLocacoes] = useState<GmLocacao[]>([])
  const [pagamentos, setPagamentos] = useState<GmPagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    Promise.all([fetchBoxes(), fetchLocacoes(), fetchPagamentos()])
      .then(([b, l, p]) => {
        setBoxes(b)
        setLocacoes(l)
        setPagamentos(p)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  const addLocacao = useCallback(
    async (row: Omit<NewLocacao, 'created_by'>) => {
      try {
        const created = await insertLocacao({ ...row, created_by: currentUserId })
        setLocacoes((prev) => [...prev, created])
      } catch (e) {
        onToast('Erro ao adicionar cliente ao box.')
        console.error(e)
        reload()
      }
    },
    [currentUserId, onToast, reload],
  )

  const editLocacao = useCallback(
    async (id: string, patch: Partial<GmLocacao>) => {
      setLocacoes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      try {
        await updateLocacao(id, patch)
      } catch (e) {
        onToast('Erro ao atualizar — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  const encerrarLocacao = useCallback(
    async (id: string, dataFim: string) => {
      const patch = { data_fim: dataFim, ativo: false }
      setLocacoes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      try {
        await updateLocacao(id, patch)
      } catch (e) {
        onToast('Erro ao encerrar a locação — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  const removeLocacao = useCallback(
    async (id: string) => {
      setLocacoes((prev) => prev.filter((l) => l.id !== id))
      setPagamentos((prev) => prev.filter((p) => p.locacao_id !== id))
      try {
        await deleteLocacao(id)
      } catch (e) {
        onToast('Erro ao remover — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  const editBox = useCallback(
    async (numero: number, patch: Partial<GmBox>) => {
      setBoxes((prev) => prev.map((b) => (b.numero === numero ? { ...b, ...patch } : b)))
      try {
        await updateBox(numero, patch)
      } catch (e) {
        onToast('Erro ao atualizar o box — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  const applyStatus = useCallback(
    async (
      locacaoId: string,
      mesReferencia: string,
      valor: number,
      status: 'pago' | 'isento' | 'aberto',
    ) => {
      const pago = status === 'pago'
      const isento = status === 'isento'
      const hojeYMD = pago ? new Date().toISOString().slice(0, 10) : null
      // Otimista: reflete no estado local antes da resposta.
      setPagamentos((prev) => {
        const idx = prev.findIndex(
          (p) => p.locacao_id === locacaoId && p.mes_referencia === mesReferencia,
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], valor, pago, isento, data_pagamento: hojeYMD }
          return next
        }
        return [
          {
            id: 'tmp-' + locacaoId + mesReferencia,
            locacao_id: locacaoId,
            mes_referencia: mesReferencia,
            valor,
            pago,
            isento,
            data_pagamento: hojeYMD,
            obs: null,
            created_by: currentUserId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]
      })
      try {
        const saved = await upsertPagamento({
          locacao_id: locacaoId,
          mes_referencia: mesReferencia,
          valor,
          pago,
          isento,
          data_pagamento: hojeYMD,
          created_by: currentUserId,
        })
        setPagamentos((prev) => {
          const others = prev.filter(
            (p) => !(p.locacao_id === locacaoId && p.mes_referencia === mesReferencia),
          )
          return [saved, ...others]
        })
      } catch (e) {
        onToast('Erro ao salvar o pagamento — recarregando.')
        console.error(e)
        reload()
      }
    },
    [currentUserId, onToast, reload],
  )

  const marcarPago = useCallback(
    (locacaoId: string, mesReferencia: string, valor: number) =>
      applyStatus(locacaoId, mesReferencia, valor, 'pago'),
    [applyStatus],
  )
  const desmarcarPago = useCallback(
    (locacaoId: string, mesReferencia: string, valor: number) =>
      applyStatus(locacaoId, mesReferencia, valor, 'aberto'),
    [applyStatus],
  )
  const setStatusMes = useCallback(
    (
      locacaoId: string,
      mesReferencia: string,
      valor: number,
      status: 'pago' | 'isento' | 'aberto',
    ) => applyStatus(locacaoId, mesReferencia, valor, status),
    [applyStatus],
  )

  return useMemo(
    () => ({
      boxes,
      locacoes,
      pagamentos,
      loading,
      error,
      reload,
      addLocacao,
      editLocacao,
      encerrarLocacao,
      removeLocacao,
      editBox,
      marcarPago,
      desmarcarPago,
      setStatusMes,
    }),
    [boxes, locacoes, pagamentos, loading, error, reload, addLocacao, editLocacao, encerrarLocacao, removeLocacao, editBox, marcarPago, desmarcarPago, setStatusMes],
  )
}
