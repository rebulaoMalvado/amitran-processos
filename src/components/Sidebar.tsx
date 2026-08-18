import { useAuth } from '../auth/AuthProvider'
import { avatarColor, initial } from '../lib/format'
import { Icon } from './Icon'

export type AppView =
  | 'mural'
  | 'processos'
  | 'contas'
  | 'vencimentos'
  | 'extrato'
  | 'manutencao'
  | 'folha'
  | 'colaboradores'

export function Sidebar({
  view,
  onNavigate,
}: {
  view: AppView
  onNavigate: (v: AppView) => void
}) {
  const { profile, session, signOut } = useAuth()
  const name = profile?.name || session?.user.email || 'Usuário'
  const uid = session?.user.id ?? 'x'

  return (
    <aside className="flex h-screen w-[250px] flex-none flex-col border-r border-border bg-sidebar p-3 pt-4">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-gradient-to-br from-[#1E3A8A] to-primary text-white">
          <Icon name="truck" className="h-[19px] w-[19px]" />
        </div>
        <div>
          <div className="text-[15px] font-bold leading-none tracking-tight">Amitran</div>
          <div className="mt-0.5 text-[11px] text-muted-2">Controle de Processos</div>
        </div>
      </div>

      <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-2">
        Assistente
      </div>
      <NavItem icon="sparkles" label="Novidades da Vic" active={view === 'mural'} onClick={() => onNavigate('mural')} />

      <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-2">
        Operação
      </div>
      <NavItem icon="grid" label="Processos" active={view === 'processos'} onClick={() => onNavigate('processos')} />

      <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-2">
        Frota
      </div>
      <NavItem icon="wrench" label="Manutenção" active={view === 'manutencao'} onClick={() => onNavigate('manutencao')} />

      <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-2">
        Departamento Pessoal
      </div>
      <NavItem icon="users" label="Folha de Pagamento" active={view === 'folha'} onClick={() => onNavigate('folha')} />
      <NavItem icon="users" label="Colaboradores" active={view === 'colaboradores'} onClick={() => onNavigate('colaboradores')} />

      <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-2">
        Financeiro
      </div>
      <NavItem icon="wallet" label="Contas a pagar" active={view === 'contas'} onClick={() => onNavigate('contas')} />
      <NavItem icon="calendar" label="Vencimentos" active={view === 'vencimentos'} onClick={() => onNavigate('vencimentos')} />
      <NavItem icon="bank" label="Extrato" active={view === 'extrato'} onClick={() => onNavigate('extrato')} />

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2">
        <span
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] text-[13px] font-semibold text-white"
          style={{ background: avatarColor(uid) }}
        >
          {initial(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight">{name}</div>
          <div className="text-[11px] text-muted-2">{profile?.role ?? '—'}</div>
        </div>
        <button
          onClick={() => signOut()}
          title="Sair"
          className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-transparent text-muted-2 hover:border-border hover:bg-[#F3F5F8] hover:text-text"
        >
          <Icon name="logout" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: 'grid' | 'wallet' | 'calendar' | 'sparkles' | 'wrench' | 'bank' | 'users'
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        'mb-0.5 flex w-full items-center gap-2.5 rounded-[9px] border px-2.5 py-2 text-[13.5px] ' +
        (active
          ? 'border-transparent bg-primary-weak font-semibold text-primary'
          : 'border-transparent font-medium text-muted hover:bg-[#F3F5F8] hover:text-text')
      }
    >
      <Icon name={icon} className="h-[17px] w-[17px] flex-none" />
      <span>{label}</span>
    </button>
  )
}
