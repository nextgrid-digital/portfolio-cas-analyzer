import type {
  FundFamilySlice,
  PortfolioHolding,
  PortfolioHoldingView,
  PortfolioMetrics,
} from '@/features/portfolio/types'

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

  return {
    totalMarketValue,
    totalCostValue,
    gainLossValue,
    gainLossPercent,
    holdingsCount: holdings.length,
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

