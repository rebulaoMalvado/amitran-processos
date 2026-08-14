import { useState } from 'react'
import { ContasView } from './ContasView'
import { ManutencaoView } from './ManutencaoView'
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
      {view === 'manutencao' && <ManutencaoView />}
    </div>
  )
}
