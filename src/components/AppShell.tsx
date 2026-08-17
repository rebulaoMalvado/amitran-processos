import { lazy, Suspense, useState } from 'react'
import { ContasView } from './ContasView'
import { ExtratoView } from './ExtratoView'
import { ManutencaoView } from './ManutencaoView'

// Carregada sob demanda (traz o parser de xlsx, que é pesado).
const FolhaView = lazy(() => import('./FolhaView').then((m) => ({ default: m.FolhaView })))
import { MuralView } from './MuralView'
import { ProcessosView } from './ProcessosView'
import { VencimentosView } from './VencimentosView'
import { Sidebar, type AppView } from './Sidebar'
import { ToastProvider } from './Toast'

export function AppShell() {
  return (
    <ToastProvider>
      <AppShellInner />
    </ToastProvider>
  )
}

function AppShellInner() {
  const [view, setView] = useState<AppView>('processos')

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <div className="hidden md:block">
        <Sidebar view={view} onNavigate={setView} />
      </div>
      {view === 'mural' && <MuralView onNavigate={setView} />}
      {view === 'processos' && <ProcessosView />}
      {view === 'contas' && <ContasView />}
      {view === 'vencimentos' && <VencimentosView />}
      {view === 'extrato' && <ExtratoView />}
      {view === 'manutencao' && <ManutencaoView />}
      {view === 'folha' && (
        <Suspense
          fallback={
            <main className="flex flex-1 items-center justify-center text-sm text-muted-2">Carregando…</main>
          }
        >
          <FolhaView />
        </Suspense>
      )}
    </div>
  )
}
