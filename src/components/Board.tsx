import { ABAS, COL_ORDER } from '../lib/board'
import type { BoardItem } from '../lib/types'
import { ProcessCard } from './ProcessCard'

export function Board({
  items,
  onOpen,
}: {
  items: BoardItem[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="-mx-6 flex-1 overflow-x-auto px-6">
      <div className="flex h-full min-w-min gap-3.5 pb-5">
        {COL_ORDER.map((key) => {
          const st = ABAS[key]
          const colItems = items.filter((i) => i.processo.status === key)
          return (
            <div key={key} className="flex w-[296px] flex-none flex-col">
              <div className="flex items-center gap-2.5 px-1.5 pb-3 pt-0.5">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: st.color }} />
                <span className="text-[13px] font-semibold tracking-tight">{st.label}</span>
                <span className="ml-auto rounded-full border border-border bg-card px-2.5 py-px text-[11.5px] font-semibold text-muted">
                  {colItems.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-0.5 pb-2">
                {colItems.length === 0 ? (
                  <div className="rounded-[11px] border border-dashed border-border-2 p-4 text-center text-[12px] text-muted-2">
                    —
                  </div>
                ) : (
                  colItems.map((item) => (
                    <ProcessCard
                      key={item.processo.id}
                      item={item}
                      onClick={() => onOpen(item.processo.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
