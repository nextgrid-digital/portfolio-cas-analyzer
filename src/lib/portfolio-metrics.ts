import type {
  AssetCategory,
  FundFamilySlice,
  PortfolioHolding,
  PortfolioHoldingView,
  PortfolioMetrics,
} from '@/features/portfolio/types'

export type CategorySlice = {
  category: AssetCategory
  marketValue: number
  allocationPercent: number
}

export function enrichHoldings(
  holdings: PortfolioHolding[],
  totalMarketValue: number
): PortfolioHoldingView[] {
  if (!totalMarketValue) {
    totalMarketValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0)
  }

  return holdings.map((holding) => {
    const gainLoss = holding.marketValue - holding.costValue
    const returnPercent = holding.costValue
      ? (gainLoss / holding.costValue) * 100
      : holding.marketValue
        ? 100
        : 0
    const allocationPercent = totalMarketValue
      ? (holding.marketValue / totalMarketValue) * 100
      : 0

    return {
      ...holding,
      gainLoss,
      returnPercent,
      allocationPercent,
    }
  })
}

export function calculateMetrics(holdings: PortfolioHolding[]): PortfolioMetrics {
  const totalMarketValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0)
  const totalCostValue = holdings.reduce((sum, holding) => sum + holding.costValue, 0)
  const gainLossValue = totalMarketValue - totalCostValue
  const gainLossPercent = totalCostValue ? (gainLossValue / totalCostValue) * 100 : 0

  // Calculate simplified XIRR (average return across holdings)
  // This is a simplified version - true XIRR requires cash flow dates
  let totalReturn = 0
  let validHoldings = 0
  holdings.forEach((holding) => {
    if (holding.costValue > 0) {
      const holdingReturn = ((holding.marketValue - holding.costValue) / holding.costValue) * 100
      totalReturn += holdingReturn
      validHoldings += 1
    }
  })
  const xirr = validHoldings > 0 ? totalReturn / validHoldings : undefined

  return {
    totalMarketValue,
    totalCostValue,
    gainLossValue,
    gainLossPercent,
    holdingsCount: holdings.length,
    xirr,
  }
}

export function buildFundFamilySlices(
  holdings: PortfolioHolding[],
  totalMarketValue: number
): FundFamilySlice[] {
  const map = new Map<string, number>()
  holdings.forEach((holding) => {
    map.set(holding.fundFamily, (map.get(holding.fundFamily) ?? 0) + holding.marketValue)
  })

  return Array.from(map.entries())
    .map(([fundFamily, marketValue]) => ({
      fundFamily,
      marketValue,
      allocationPercent: totalMarketValue ? (marketValue / totalMarketValue) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue)
}

export function buildCategorySlices(
  holdings: PortfolioHolding[],
  totalMarketValue: number
): CategorySlice[] {
  const map = new Map<AssetCategory, number>()
  holdings.forEach((holding) => {
    map.set(holding.category, (map.get(holding.category) ?? 0) + holding.marketValue)
  })

  const categoryOrder: AssetCategory[] = ['Equity', 'Debt', 'Hybrid', 'Gold', 'Other']
  return categoryOrder
    .filter((cat) => map.has(cat))
    .map((category) => ({
      category,
      marketValue: map.get(category) ?? 0,
      allocationPercent: totalMarketValue ? ((map.get(category) ?? 0) / totalMarketValue) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue)
}

