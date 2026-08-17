// Feriados nacionais brasileiros (fixos + móveis via Páscoa).
// Usados p/ decidir hora extra 100% (domingo ou feriado).

function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function ymd(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const cache = new Map<number, Set<string>>()

export function feriadosNacionais(year: number): Set<string> {
  const hit = cache.get(year)
  if (hit) return hit
  const s = new Set<string>()
  const fixos = [
    [1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25],
  ]
  for (const [mo, da] of fixos) s.add(ymd(new Date(year, mo - 1, da)))
  const e = easter(year)
  const add = (offset: number) => s.add(ymd(new Date(e.getFullYear(), e.getMonth(), e.getDate() + offset)))
  add(-48) // Carnaval segunda
  add(-47) // Carnaval terça
  add(-2) // Sexta-feira Santa
  add(60) // Corpus Christi
  cache.set(year, s)
  return s
}

// Hora extra 100%? Domingo ou feriado nacional.
export function ehCemPorCento(ymdStr: string): boolean {
  const d = new Date(ymdStr + 'T00:00:00')
  if (d.getDay() === 0) return true // domingo
  return feriadosNacionais(d.getFullYear()).has(ymdStr)
}
