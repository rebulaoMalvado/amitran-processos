import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { fetchProfiles } from '../lib/api'
import { useBoard } from '../hooks/useBoard'
import { SORT_OPTIONS, sortItems, type SortKey } from '../lib/sort'
import type { Profile } from '../lib/types'
import { Board } from './Board'
import { Icon } from './Icon'
import { ProcessDrawer } from './ProcessDrawer'
import { Stats } from './Stats'
import { useToast } from './Toast'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function ProcessosView() {
  const { session } = useAuth()
  const toast = useToast()
  const board = useBoard(session?.user.id ?? null, toast)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('data_desc')

  useEffect(() => {
    fetchProfiles()
      .then((list) => {
        const map: Record<string, Profile> = {}
        for (const p of list) map[p.id] = p
        setProfiles(map)
      })
      .catch((e) => console.error('Falha ao carregar profiles', e))
  }, [])

  const abertos = board.items.filter((i) => i.processo.status !== 'recebido').length
  const day = new Date().getDay()
  const isConfDay = day === 1 || day === 3 || day === 5

  const selected = useMemo(
    () => board.items.find((i) => i.processo.id === selectedId) ?? null,
    [board.items, selectedId],
  )
  const sortedItems = useMemo(() => sortItems(board.items, sort), [board.items, sort])

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border bg-bg px-6 py-4">
        <div>
          <div className="text-[19px] font-bold tracking-tight">Processos</div>
          <div className="mt-px text-[12.5px] text-muted">
            {board.loading
              ? 'Carregando…'
              : `${abertos} processos abertos · ${board.items.length} no total`}
          </div>
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2 rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[12.5px] text-muted">
          <span className="hidden text-muted-2 sm:inline">Ordenar</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="cursor-pointer bg-transparent font-medium text-text outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div
          className={
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium ' +
            (isConfDay
              ? 'border-[#F6E0A6] bg-[#FEF6E3] text-[#92610a]'
              : 'border-border bg-card text-muted')
          }
        >
          <Icon name="clock" className="h-[15px] w-[15px]" />
          {isConfDay ? `${DIAS[day]} · dia de conferência de faturamento` : 'Conferência: seg · qua · sex'}
        </div>
        <button
          onClick={() => board.reload()}
          disabled={board.loading}
          title="Recarregar o board (novos deals fechados aparecem aqui)"
          className="flex items-center gap-1.5 rounded-[9px] border border-border-2 bg-card px-3.5 py-2.5 text-[13.5px] font-semibold text-muted shadow-sm hover:bg-[#F3F5F8] disabled:opacity-60"
        >
          <Icon name="refresh" className="h-4 w-4" />
          Atualizar
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-2 pt-5">
        {board.error ? (
          <div className="rounded-xl border border-[#F6D3D0] bg-[#FCEBEA] p-4 text-[13px] text-[#b91c1c]">
            Erro ao carregar o board: {board.error}
          </div>
        ) : (
          <>
            <Stats items={board.items} />
            <Board items={sortedItems} onOpen={setSelectedId} />
          </>
        )}
      </div>

      {selected && (
        <ProcessDrawer
          key={selected.processo.id}
          item={selected}
          profiles={profiles}
          board={board}
          onClose={() => setSelectedId(null)}
        />
      )}
    </main>
  )
}
