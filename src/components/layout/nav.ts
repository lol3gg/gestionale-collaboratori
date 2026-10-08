import { Building2, Calendar, LayoutDashboard, Phone, Search, Users, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Mostra il contatore richiami (scaduti + oggi) sull’icona. */
  badge?: 'callbacks'
}

export const adminNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: 'callbacks' },
  { to: '/chiamate', label: 'Chiamate', icon: Phone },
  { to: '/calendario', label: 'Calendario', icon: Calendar },
  { to: '/aziende', label: 'Aziende', icon: Building2 },
  { to: '/ricerca', label: 'Ricerca', icon: Search },
  { to: '/collaboratori', label: 'Collaboratori', icon: Users },
]

export const collaboratorNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendario', label: 'Calendario', icon: Calendar },
  { to: '/le-mie-aziende', label: 'Le mie aziende', icon: Building2, badge: 'callbacks' },
]
