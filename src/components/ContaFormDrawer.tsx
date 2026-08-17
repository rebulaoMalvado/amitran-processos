import { useState } from 'react'
import { CATEGORIAS, CATEGORIA_KEYS, FORMAS_PAGAMENTO } from '../lib/contas'
import { brl, fmtDay } from '../lib/format'
import type { ContaPagar, DealOption } from '../lib/types'
import type { ContaFormData } from '../hooks/useContas'
import { Icon } from './Icon'

const inputCls =
  'w-full rounded-[9px] border border-border-2 bg-card px-2.5 py-2 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak'

interface Props {
  conta: ContaPagar | null // null = nova
  deals: DealOption[]
  onClose: () => void
  onSubmit: (form: ContaFormData) => void
}

export function ContaFormDrawer({ conta, deals, onClose, onSubmit }: Props) {
  const [descricao, setDescricao] = useState(conta?.descricao ?? '')
  const [categoria, setCategoria] = useState<ContaPagar['categoria']>(
    conta?.categoria ?? 'diversos',
  )
  const [favorecido, setFavorecido] = useState(conta?.favorecido ?? '')
  const [dealId, setDealId] = useState<string | null>(conta?.deal_id ?? null)
  const [valor, setValor] = useState(conta ? String(conta.valor) : '')
  const [vencimento, setVencimento] = useState(conta?.vencimento ?? '')
  const [forma, setForma] = useState(conta?.forma_pagamento ?? '')
  const [obs, setObs] = useState(conta?.obs ?? '')
  const [erro, setErro] = useState<string | null>(null)

  function submit() {
    const v = Number(String(valor).replace(',', '.'))
    if (!descricao.trim()) return setErro('Informe a descrição.')
    if (!vencimento) return setErro('Informe o vencimento.')
    if (isNaN(v) || v <= 0) return setErro('Informe um valor válido.')
    onSubmit({
      descricao,
      categoria,
      favorecido,
      deal_id: dealId,
      valor: v,
      vencimento,
      forma_pagamento: forma,
      obs,
    })
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]" />
      <aside className="fixed right-0 top-0 z-[80] flex h-screen w-[min(460px,96vw)] flex-col border-l border-border bg-card shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="text-[17px] font-bold tracking-tight">
            {conta ? 'Editar conta' : 'Nova conta a pagar'}
          </div>
          <button
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-card text-muted hover:bg-[#F3F5F8]"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Field label="Descrição *">
            <input
              className={inputCls}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Frete terceiro — mudança Usiminas"
              autoFocus
            />
          </Field>

          <Field label="Categoria">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIA_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setCategoria(k)}
                  className={
                    'rounded-full border px-2.5 py-1 text-[11.5px] font-medium ' +
                    (categoria === k
                      ? 'border-primary text-primary'
                      : 'border-border-2 text-muted hover:bg-[#F3F5F8]')
                  }
                  style={categoria === k ? { background: CATEGORIAS[k].bg } : undefined}
                >
                  {CATEGORIAS[k].label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$) *">
              <input
                className={inputCls}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </Field>
            <Field label="Vencimento *">
              <input
                type="date"
                className={inputCls}
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Favorecido (quem recebe)">
            <input
              className={inputCls}
              value={favorecido}
              onChange={(e) => setFavorecido(e.target.value)}
              placeholder="Fornecedor, parceiro, motorista…"
            />
          </Field>

          <Field label="Vincular à mudança (opcional — para margem por mudança)">
            <select
              className={inputCls}
              value={dealId ?? ''}
              onChange={(e) => setDealId(e.target.value || null)}
            >
              <option value="">— sem vínculo —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome} · {brl(d.valor)} · {fmtDay(d.data_mudanca)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Forma de pagamento">
            <select className={inputCls} value={forma} onChange={(e) => setForma(e.target.value)}>
              <option value="">—</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Observação">
            <textarea
              className={inputCls + ' min-h-[64px] resize-y'}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Notas internas…"
            />
          </Field>

          {erro && (
            <div className="mt-1 rounded-lg border border-[#F6D3D0] bg-[#FCEBEA] px-3 py-2 text-[12.5px] font-medium text-[#b91c1c]">
              {erro}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-3.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-[9px] border border-border-2 bg-card py-2.5 text-[13.5px] font-semibold text-muted hover:bg-[#F3F5F8]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="flex-1 rounded-[9px] bg-primary py-2.5 text-[13.5px] font-semibold text-white hover:bg-primary-hover"
          >
            {conta ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </aside>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-[12.5px] text-muted">{label}</div>
      {children}
    </div>
  )
}
