import { useState } from 'react'
import { avatarColor, fmtStamp, initial } from '../lib/format'
import type { ObsNote, Profile } from '../lib/types'
import { Icon } from './Icon'

export function Thread({
  title,
  icon,
  notes,
  profiles,
  onAdd,
}: {
  title: string
  icon: 'info' | 'clock'
  notes: ObsNote[]
  profiles: Record<string, Profile>
  onAdd: (text: string) => void
}) {
  const [text, setText] = useState('')

  function submit() {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }

  return (
    <div className="mt-2 rounded-[10px] border border-border bg-[#F7F8FA] p-3">
      <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-2">
        <Icon name={icon} className="h-[13px] w-[13px]" />
        {title}
      </div>
      {notes.length === 0 ? (
        <div className="pb-2 pt-0.5 text-[12px] text-muted-2">Nenhum registro ainda.</div>
      ) : (
        <div className="flex flex-col">
          {notes.map((n, idx) => {
            const p = profiles[n.by]
            return (
              <div
                key={idx}
                className="flex gap-2.5 py-1.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border"
              >
                <span
                  className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] text-[10px] font-semibold text-white"
                  style={{ background: avatarColor(n.by) }}
                >
                  {initial(p?.name, '?')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold">{p?.name ?? 'Usuário'}</span>
                    <span className="ml-auto text-[10.5px] text-muted-2">{fmtStamp(n.at)}</span>
                  </div>
                  <div className="mt-px text-[12.5px] leading-snug text-muted">{n.text}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-2.5 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="Escreva e salve…"
          className="flex-1 rounded-lg border border-border-2 bg-card px-2.5 py-2 text-[12.5px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
        />
        <button
          onClick={submit}
          className="rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-primary-hover"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}
