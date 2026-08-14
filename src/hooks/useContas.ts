import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteConta,
  fetchContas,
  fetchDealOptions,
  insertConta,
  updateConta,
  type NewConta,
} from '../lib/contas'
import { brl, nowISO } from '../lib/format'
import type { ContaPagar, DealOption, LogEntry } from '../lib/types'

export interface ContaFormData {
  descricao: string
  categoria: ContaPagar['categoria']
  favorecido: string
  deal_id: string | null
  valor: number
  vencimento: string
  forma_pagamento: string
  obs: string
}

export interface UseContas {
  contas: ContaPagar[]
  deals: DealOption[]
  loading: boolean
  error: string | null
  reload: () => void
  addConta: (form: ContaFormData) => Promise<void>
  editConta: (id: string, form: ContaFormData) => Promise<void>
  markPaid: (id: string, valorPago: number, forma: string) => Promise<void>
  reopen: (id: string) => Promise<void>
  confirmConta: (id: string) => Promise<void>
  removeConta: (id: string) => Promise<void>
}

export function useContas(
  currentUserId: string | null,
  onToast: (msg: string) => void,
): UseContas {
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    Promise.all([fetchContas(), fetchDealOptions()])
      .then(([c, d]) => {
        setContas(c)
        setDeals(d)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const logEntry = (txt: string): LogEntry => ({
    who: currentUserId ?? 'sistema',
    txt,
    at: nowISO(),
  })

  const addConta = useCallback(
    async (form: ContaFormData) => {
      const row: NewConta = {
        descricao: form.descricao.trim(),
        categoria: form.categoria,
        favorecido: form.favorecido.trim() || null,
        deal_id: form.deal_id,
        valor: form.valor,
        vencimento: form.vencimento,
        forma_pagamento: form.forma_pagamento || null,
        obs: form.obs.trim() || null,
        created_by: currentUserId,
        log: [logEntry(`lançou "${form.descricao.trim()}" (${brl(form.valor)})`)],
      }
      try {
        const created = await insertConta(row)
        setContas((prev) => [created, ...prev])
      } catch (e) {
        onToast('Erro ao salvar a conta.')
        console.error(e)
        reload()
      }
    },
    [currentUserId, onToast, reload],
  )

  // Aplica update otimista + persiste.
  const patchLocal = useCallback(
    async (id: string, patch: Partial<ContaPagar>) => {
      setContas((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      try {
        await updateConta(id, patch)
      } catch (e) {
        onToast('Erro ao atualizar — recarregando.')
        console.error(e)
        reload()
      }
    },
    [onToast, reload],
  )

  const editConta = useCallback(
    async (id: string, form: ContaFormData) => {
      const conta = contas.find((c) => c.id === id)
      if (!conta) return
      await patchLocal(id, {
        descricao: form.descricao.trim(),
        categoria: form.categoria,
        favorecido: form.favorecido.trim() || null,
        deal_id: form.deal_id,
        valor: form.valor,
        vencimento: form.vencimento,
        forma_pagamento: form.forma_pagamento || null,
        obs: form.obs.trim() || null,
        log: [logEntry('editou a conta'), ...conta.log],
      })
    },
    [contas, patchLocal],
  )

  const markPaid = useCallback(
    async (id: string, valorPago: number, forma: string) => {
      const conta = contas.find((c) => c.id === id)
      if (!conta) return
      await patchLocal(id, {
        status: 'paga',
        pago_em: new Date().toISOString().slice(0, 10),
        valor_pago: valorPago,
        forma_pagamento: forma || conta.forma_pagamento,
        log: [logEntry(`baixou o pagamento (${brl(valorPago)})`), ...conta.log],
      })
    },
    [contas, patchLocal],
  )

  const reopen = useCallback(
    async (id: string) => {
      const conta = contas.find((c) => c.id === id)
      if (!conta) return
      await patchLocal(id, {
        status: 'aberta',
        pago_em: null,
        valor_pago: null,
        log: [logEntry('reabriu a conta'), ...conta.log],
      })
    },
    [contas, patchLocal],
  )

  // Confirma uma conta importada (pendente -> aberta), após revisão.
  const confirmConta = useCallback(
    async (id: string) => {
      const conta = contas.find((c) => c.id === id)
      if (!conta) return
      await patchLocal(id, {
        status: 'aberta',
        log: [logEntry('confirmou a conta (revisão da importação)'), ...conta.log],
      })
    },
    [contas, patchLocal],
  )

  const removeConta = useCallback(
    async (id: string) => {
      setContas((prev) => prev.filter((c) => c.id !== id))
      try {
        await deleteConta(id)
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
      contas,
      deals,
      loading,
      error,
      reload,
      addConta,
      editConta,
      markPaid,
      reopen,
      confirmConta,
      removeConta,
    }),
    [contas, deals, loading, error, reload, addConta, editConta, markPaid, reopen, confirmConta, removeConta],
  )
}
