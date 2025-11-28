import { Command, PieChart } from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Portfolio Analyzer',
    email: 'Local-first workspace',
    avatar: '/images/favicon.png',
  },
  teams: [
    {
      name: 'MF Portfolio',
      logo: Command,
      plan: 'Client-side only',
    },
  ],
  navGroups: [
    {
      title: 'Workspace',
      items: [
        {
          title: 'CAS Analyzer',
          url: '/',
          icon: PieChart,
        },
      ],
    },
  ],
}
