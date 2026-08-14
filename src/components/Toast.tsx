import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { Icon } from './Icon'

interface ToastItem {
  id: number
  msg: string
}

const ToastCtx = createContext<(msg: string) => void>(() => {})

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((msg: string) => {
    const id = ++seq
    setItems((prev) => [...prev, { id, msg }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex max-w-[340px] items-center gap-2.5 rounded-[10px] bg-[#0F172A] px-3.5 py-2.5 text-[13px] text-white shadow-lg"
          >
            <Icon name="info" className="h-4 w-4 flex-none text-[#60A5FA]" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastCtx)
}
