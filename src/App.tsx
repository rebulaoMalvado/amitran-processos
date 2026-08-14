import { AuthProvider, useAuth } from './auth/AuthProvider'
import { Login } from './components/Login'
import { AppShell } from './components/AppShell'

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-sm text-muted-2">Carregando…</div>
      </div>
    )
  }

  return session ? <AppShell /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
