import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (error) {
      setError(
        error === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error,
      )
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-primary text-white shadow-md">
            <svg
              className="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 17h4V5H2v12h3" />
              <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
              <circle cx="7.5" cy="17.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-text">
            Controle de Processos
          </h1>
          <p className="mt-1 text-sm text-muted">Amitran Mudanças</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-md"
        >
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">
              E-mail
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border-2 bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
              placeholder="voce@amitran.com.br"
            />
          </label>

          <label className="mb-1 block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">
              Senha
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border-2 bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-weak"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-[#F6D3D0] bg-[#FCEBEA] px-3 py-2 text-[13px] font-medium text-[#b91c1c]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border-2 disabled:text-muted-2"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-muted-2">
            Acesso restrito ao time administrativo. As contas são criadas
            internamente — fale com o responsável se não tiver acesso.
          </p>
        </form>
      </div>
    </div>
  )
}
