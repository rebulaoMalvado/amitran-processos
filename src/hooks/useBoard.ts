import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ABAS, ALL_FIELDS, COL_ORDER, NEXT } from '../lib/board'
import { loadBoard, saveProcesso } from '../lib/api'
import { missingRequired } from '../lib/fields'
import { nowISO } from '../lib/format'
import type {
  BoardItem,
  FieldEntry,
  LogEntry,
  ObsNote,
  Processo,
  ProcessoStatus,
} from '../lib/types'

// Chave da thread de atualizações do aviso de vencimento (guardada em obs).
export const VENC_THREAD_KEY = 'ac_venc_updates'

interface UseBoard {
  items: BoardItem[]
  loading: boolean
  error: string | null
  reload: () => void
  toggleBool: (id: string, fieldId: string) => void
  setVal: (id: string, fieldId: string, value: string) => void
  setAvaria: (id: string, v: 'sim' | 'nao') => void
  addObs: (id: string, aba: ProcessoStatus, text: string) => void
  addVencUpdate: (id: string, text: string) => void
  advance: (id: string) => void
  regress: (id: string) => void
  moveStatus: (id: string, to: ProcessoStatus) => void
}

export function useBoard(
  currentUserId: string | null,
  onToast: (msg: string) => void,
): UseBoard {
  const [items, setItems] = useState<BoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Espelho sempre atualizado dos itens, para computar o patch de forma
  // síncrona (fora do updater do setState) antes de persistir.
  const itemsRef = useRef<BoardItem[]>([])
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const reload = useCallback(() => {
    setLoading(true)
    loadBoard()
      .then((data) => {
        setItems(data)
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Aplica uma mutação otimista na lista local e persiste no Supabase.
  // `mutate` recebe o processo atual e devolve o patch (campos/obs/log/status).
  const apply = useCallback(
    (
      id: string,
      mutate: (p: Processo) => Partial<Pick<Processo, 'campos' | 'obs' | 'log' | 'status'>>,
    ) => {
      if (!currentUserId) return
      const it = itemsRef.current.find((x) => x.processo.id === id)
      if (!it) return
      // Computa o patch a partir do estado atual (ref) — não dentro do updater.
      const patch = mutate(it.processo)
      setItems((prev) =>
        prev.map((x) =>
          x.processo.id === id ? { ...x, processo: { ...x.processo, ...patch } } : x,
        ),
      )
      saveProcesso(id, patch).catch((e) => {
        onToast('Erro ao salvar — recarregando.')
        console.error(e)
        reload()
      })
    },
    [currentUserId, onToast, reload],
  )

  const log = (p: Processo, txt: string): LogEntry[] => [
    { who: currentUserId!, txt, at: nowISO() },
    ...p.log,
  ]

  const toggleBool = useCallback(
    (id: string, fieldId: string) =>
      apply(id, (p) => {
        const def = ALL_FIELDS[fieldId]
        const campos = { ...p.campos }
        const was = !!campos[fieldId]?.by
        if (was) {
          delete campos[fieldId]
        } else {
          campos[fieldId] = { by: currentUserId!, at: nowISO() }
        }
        return {
          campos,
          log: log(p, `${was ? 'desmarcou' : 'marcou'} "${def?.label ?? fieldId}"`),
        }
      }),
    [apply, currentUserId],
  )

  const setVal = useCallback(
    (id: string, fieldId: string, value: string) =>
      apply(id, (p) => {
        const def = ALL_FIELDS[fieldId]
        const campos = { ...p.campos }
        const v = value.trim()
        if (v) {
          campos[fieldId] = { value: v, by: currentUserId!, at: nowISO() }
        } else {
          delete campos[fieldId]
        }
        return {
          campos,
          log: log(p, v ? `preencheu ${def?.label ?? fieldId}: ${v}` : `limpou ${def?.label ?? fieldId}`),
        }
      }),
    [apply, currentUserId],
  )

  const setAvaria = useCallback(
    (id: string, v: 'sim' | 'nao') =>
      apply(id, (p) => {
        const campos = { ...p.campos }
        campos['ac_avaria'] = { value: v, by: currentUserId!, at: nowISO() }
        if (v === 'nao') delete campos['ac_avaria_valor']
        return {
          campos,
          log: log(p, `marcou avaria: ${v === 'sim' ? 'Sim' : 'Não'}`),
        }
      }),
    [apply, currentUserId],
  )

  const addObs = useCallback(
    (id: string, aba: ProcessoStatus, text: string) => {
      const t = text.trim()
      if (!t) return
      apply(id, (p) => {
        const obs = { ...p.obs }
        const note: ObsNote = { by: currentUserId!, at: nowISO(), text: t }
        obs[aba] = [note, ...(obs[aba] ?? [])]
        return { obs, log: log(p, `observou em ${ABAS[aba].label}`) }
      })
    },
    [apply, currentUserId],
  )

  const addVencUpdate = useCallback(
    (id: string, text: string) => {
      const t = text.trim()
      if (!t) return
      apply(id, (p) => {
        const obs = { ...p.obs }
        const note: ObsNote = { by: currentUserId!, at: nowISO(), text: t }
        obs[VENC_THREAD_KEY] = [note, ...(obs[VENC_THREAD_KEY] ?? [])]
        return { obs, log: log(p, 'atualizou o aviso de vencimento') }
      })
    },
    [apply, currentUserId],
  )

  const advance = useCallback(
    (id: string) => {
      const item = items.find((it) => it.processo.id === id)
      if (!item) return
      if (missingRequired(item.processo).length) return
      const next = NEXT[item.processo.status]
      if (!next) return
      apply(id, (p) => {
        const from = ABAS[p.status].label
        return {
          status: next,
          log: log(p, `avançou de "${from}" para "${ABAS[next].label}"`),
        }
      })
      onToast(`Movido para ${ABAS[next].label}`)
    },
    [apply, items, onToast],
  )

  // Volta para a etapa anterior (correção de engano). Fica registrado no log.
  const regress = useCallback(
    (id: string) => {
      const item = items.find((it) => it.processo.id === id)
      if (!item) return
      const idx = COL_ORDER.indexOf(item.processo.status)
      const prev = idx > 0 ? COL_ORDER[idx - 1] : null
      if (!prev) return
      apply(id, (p) => {
        const from = ABAS[p.status].label
        return {
          status: prev,
          log: log(p, `voltou de "${from}" para "${ABAS[prev].label}" (correção)`),
        }
      })
      onToast(`Voltou para ${ABAS[prev].label}`)
    },
    [apply, items, onToast],
  )

  const moveStatus = useCallback(
    (id: string, to: ProcessoStatus) =>
      apply(id, (p) => {
        if (to === p.status) return {}
        const from = ABAS[p.status].label
        return {
          status: to,
          log: log(p, `moveu manualmente de "${from}" para "${ABAS[to].label}"`),
        }
      }),
    [apply],
  )

  return useMemo(
    () => ({
      items,
      loading,
      error,
      reload,
      toggleBool,
      setVal,
      setAvaria,
      addObs,
      addVencUpdate,
      advance,
      regress,
      moveStatus,
    }),
    [
      items,
      loading,
      error,
      reload,
      toggleBool,
      setVal,
      setAvaria,
      addObs,
      addVencUpdate,
      advance,
      regress,
      moveStatus,
    ],
  )
}

// Reexport util pra componentes que só querem checar campos.
export { missingRequired }
export type { FieldEntry }
