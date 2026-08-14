// Helpers de formatação.

export function brl(n: number | null | undefined): string {
  return 'R$ ' + (n ?? 0).toLocaleString('pt-BR')
}

// Data ISO/date do banco -> "dd/mm".
export function fmtDay(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + (dateStr.length <= 10 ? 'T00:00:00' : ''))
  if (isNaN(d.getTime())) return '—'
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

// Timestamp assinado -> "dd/mm HH:MM".
export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

// Cor determinística por profile id (avatares no log/threads/assinaturas).
const AVATAR_COLORS = [
  '#6366F1',
  '#3B82F6',
  '#22C55E',
  '#EAB308',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
]
export function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function initial(name: string | null | undefined, fallback = '?'): string {
  const s = (name || '').trim()
  return s ? s[0].toUpperCase() : fallback
}
