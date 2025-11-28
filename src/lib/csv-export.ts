import type { PortfolioAnalysis, PortfolioHoldingView } from '@/features/portfolio/types'

const headers = [
  'Fund Family',
  'Folio',
  'Scheme Name',
  'Category',
  'Units',
  'NAV',
  'Market Value',
  'Cost Value',
  'Gain/Loss',
  'Return %',
  'Allocation %',
]

export function buildCsvRow(values: (string | number)[]) {
  return values
    .map((value) => {
      if (typeof value === 'number') {
        return value.toString()
      }
      const stringValue = value ?? ''
      return stringValue.includes(',') ? `"${stringValue}"` : stringValue
    })
    .join(',')
}

export function downloadAnalysisCsv(
  analysis: PortfolioAnalysis,
  holdings: PortfolioHoldingView[]
) {
  const rows = [
    headers.join(','),
    ...holdings.map((holding) =>
      buildCsvRow([
        holding.fundFamily,
        holding.folio,
        holding.schemeName,
        holding.category,
        holding.units,
        holding.nav,
        holding.marketValue,
        holding.costValue,
        holding.gainLoss,
        holding.returnPercent,
        holding.allocationPercent,
      ])
    ),
  ]

  rows.push('')
  rows.push(
    buildCsvRow([
      'Total',
      '',
      '',
      '',
      '',
      '',
      analysis.metrics.totalMarketValue,
      analysis.metrics.totalCostValue,
      analysis.metrics.gainLossValue,
      analysis.metrics.gainLossPercent,
      100,
    ])
  )

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${analysis.label.replace(/\s+/g, '-')}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

