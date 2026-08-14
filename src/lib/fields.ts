import { ALL_FIELDS, REQUIRED } from './board'
import type { FieldEntry, Processo } from './types'

// Um campo bool está satisfeito quando existe entrada (marcado).
// Campos de texto/select/venc/avaria exigem `value` não-vazio.
export function fieldSatisfied(campos: Record<string, FieldEntry>, id: string): boolean {
  const entry = campos[id]
  if (!entry) return false
  const def = ALL_FIELDS[id]
  if (def?.type === 'bool') return !!entry.by
  return !!(entry.value && entry.value.trim())
}

export function boolOn(campos: Record<string, FieldEntry>, id: string): boolean {
  const entry = campos[id]
  return !!(entry && entry.by && entry.value === undefined)
}

export function fieldValue(campos: Record<string, FieldEntry>, id: string): string {
  return campos[id]?.value ?? ''
}

// Campos obrigatórios da aba atual que ainda faltam (rótulos legíveis).
export function missingRequired(p: Processo): string[] {
  return (REQUIRED[p.status] ?? [])
    .filter((id) => !fieldSatisfied(p.campos, id))
    .map((id) => ALL_FIELDS[id]?.label ?? id)
}
