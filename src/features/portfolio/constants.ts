import type { AssetCategory } from './types'

export const ASSET_CATEGORIES: AssetCategory[] = [
  'Equity',
  'Debt',
  'Hybrid',
  'Gold',
  'Other',
]

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  Equity: 'var(--chart-1)',
  Debt: 'var(--chart-2)',
  Hybrid: 'var(--chart-3)',
  Gold: 'var(--chart-4)',
  Other: 'var(--chart-5, #94a3b8)',
}

export const LOCAL_STORAGE_KEY = 'mf-portfolio-cas-analyses'

export const PORTFOLIO_THRESHOLD = 0.01 // ignore market values below this

