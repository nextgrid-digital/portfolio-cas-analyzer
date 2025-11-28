export type AssetCategory = 'Equity' | 'Debt' | 'Hybrid' | 'Gold' | 'Other'

export type PortfolioHolding = {
  id: string
  fundFamily: string
  folio: string
  schemeName: string
  category: AssetCategory
  units: number
  nav: number
  marketValue: number
  costValue: number
}

export type PortfolioHoldingView = PortfolioHolding & {
  gainLoss: number
  returnPercent: number
  allocationPercent: number
}

export type FundFamilySlice = {
  fundFamily: string
  marketValue: number
  allocationPercent: number
}

export type PortfolioMetrics = {
  totalMarketValue: number
  totalCostValue: number
  gainLossValue: number
  gainLossPercent: number
  holdingsCount: number
}

export type PortfolioAnalysis = {
  id: string
  label: string
  fileName?: string
  createdAt: number
  holdings: PortfolioHolding[]
  metrics: PortfolioMetrics
  warnings: string[]
}

export type CategoryFilter = AssetCategory | 'All'

