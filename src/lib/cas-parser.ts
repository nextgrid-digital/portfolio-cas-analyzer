import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type TextItem,
  getDocument,
} from 'pdfjs-dist'
import { PORTFOLIO_THRESHOLD } from '@/features/portfolio/constants'
import type { AssetCategory, PortfolioHolding } from '@/features/portfolio/types'

GlobalWorkerOptions.workerSrc = workerSrc

type ParseResult = {
  holdings: PortfolioHolding[]
  summary: {
    totalMarketValue?: number
    totalCostValue?: number
  }
  warnings: string[]
}

const CATEGORY_TOKENS: Record<AssetCategory, RegExp> = {
  Equity: /equity/i,
  Debt: /debt/i,
  Hybrid: /hybrid/i,
  Gold: /gold/i,
  Other: /./, // fallback
}

type DraftHolding = {
  fundFamily: string
  folio: string
  schemeName: string
  category: AssetCategory
  units?: number
  nav?: number
  marketValue?: number
  costValue?: number
}

const numberFromLine = (line: string) => {
  const normalized = line.replace(/[^\d.\-]/g, '')
  return normalized ? Number.parseFloat(normalized) : undefined
}

const tolerancePct = 0.02

export async function parseCasPdf(file: File): Promise<ParseResult> {
  const pdf = await loadPdf(file)
  const lines = await extractLines(pdf)
  return parseCasLines(lines, file.name)
}

export function parseCasCsv(input: string): ParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    throw new Error('CSV input must include a header and at least one row.')
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const idx = (field: string) => {
    const index = header.indexOf(field)
    if (index === -1) {
      throw new Error(`CSV column "${field}" is required.`)
    }
    return index
  }

  const holdings: PortfolioHolding[] = lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(',').map((cell) => cell.trim())
    const get = (field: string) => cells[idx(field)] ?? ''
    const units = Number.parseFloat(get('units') || '0')
    const nav = Number.parseFloat(get('nav') || '0')
    const marketValue = Number.parseFloat(get('marketvalue') || get('market_value') || '0')
    const costValue = Number.parseFloat(get('costvalue') || get('cost_value') || '0')

    if (!get('schemename')) {
      throw new Error(`Row ${rowIndex + 2}: Scheme name is required.`)
    }

    return {
      id: `${get('fundfamily')}-${get('folio')}-${get('schemename')}-${rowIndex}`,
      fundFamily: get('fundfamily') || 'Unknown Family',
      folio: get('folio') || 'N/A',
      schemeName: get('schemename'),
      category: (normalizeCategory(get('category')) ?? 'Other') as AssetCategory,
      units: Number.isNaN(units) ? 0 : units,
      nav: Number.isNaN(nav) ? 0 : nav,
      marketValue: Number.isNaN(marketValue) ? 0 : marketValue,
      costValue: Number.isNaN(costValue) ? 0 : costValue,
    }
  })

  const summary = summarizeHoldings(holdings)
  return {
    holdings: scrubHoldings(holdings),
    summary,
    warnings: [],
  }
}

function normalizeCategory(input: string): AssetCategory | null {
  const value = input?.trim()
  if (!value) return null
  const match = (Object.keys(CATEGORY_TOKENS) as AssetCategory[]).find((category) =>
    CATEGORY_TOKENS[category].test(value)
  )
  return match ?? 'Other'
}

async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const data = await file.arrayBuffer()
  return getDocument({ data }).promise
}

async function extractLines(pdf: PDFDocumentProxy): Promise<string[]> {
  const lines: string[] = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const content = await page.getTextContent()
    content.items.forEach((item) => {
      const text = (item as TextItem).str?.trim()
      if (text) {
        lines.push(text)
      }
    })
  }
  return lines
}

function parseCasLines(lines: string[], fileName?: string): ParseResult {
  let currentCategory: AssetCategory = 'Other'
  let currentFamily = ''
  let currentFolio = ''
  let draft: DraftHolding | null = null
  const summaryTotals = {
    marketValue: undefined as number | undefined,
    costValue: undefined as number | undefined,
  }

  const holdingsMap = new Map<string, DraftHolding>()
  const warnings: string[] = []

  const commitDraft = () => {
    if (
      draft &&
      draft.schemeName &&
      typeof draft.marketValue === 'number' &&
      typeof draft.costValue === 'number'
    ) {
      const key = `${draft.fundFamily}|${draft.folio}|${draft.schemeName}`
      holdingsMap.set(key, { ...draft })
      draft = null
    }
  }

  lines.forEach((line) => {
    const normalized = line.replace(/\s+/g, ' ').trim()

    // Category headers
    const maybeCategory = (Object.keys(CATEGORY_TOKENS) as AssetCategory[]).find((category) =>
      category !== 'Other' ? CATEGORY_TOKENS[category].test(normalized) : false
    )
    if (maybeCategory) {
      currentCategory = maybeCategory
      return
    }

    if (/mutual fund/i.test(normalized) || /fund house/i.test(normalized)) {
      currentFamily = normalized.replace(/(mutual fund|fund house)/i, '').trim() || normalized
      return
    }

    if (/folio/i.test(normalized)) {
      const match =
        normalized.match(/folio\s*(no\.?|number)?\s*[:\-]?\s*(.+)$/i)?.[2]?.trim() ?? normalized
      currentFolio = match
      return
    }

    if (/scheme/i.test(normalized) && !/summary/i.test(normalized)) {
      commitDraft()
      draft = {
        fundFamily: currentFamily || 'Unknown Family',
        folio: currentFolio || 'N/A',
        schemeName: normalized.replace(/.*scheme\s*name[:\-]?\s*/i, '') || normalized,
        category: currentCategory,
      }
      return
    }

    if (/closing units?/i.test(normalized)) {
      draft ??= {
        fundFamily: currentFamily || 'Unknown Family',
        folio: currentFolio || 'N/A',
        schemeName: `Scheme @ ${currentFolio || 'N/A'}`,
        category: currentCategory,
      }
      draft.units = numberFromLine(normalized)
      return
    }

    if (/(nav|net asset value)/i.test(normalized)) {
      draft ??= {
        fundFamily: currentFamily || 'Unknown Family',
        folio: currentFolio || 'N/A',
        schemeName: `Scheme @ ${currentFolio || 'N/A'}`,
        category: currentCategory,
      }
      draft.nav = numberFromLine(normalized)
      return
    }

    if (/market value/i.test(normalized)) {
      draft ??= {
        fundFamily: currentFamily || 'Unknown Family',
        folio: currentFolio || 'N/A',
        schemeName: `Scheme @ ${currentFolio || 'N/A'}`,
        category: currentCategory,
      }
      draft.marketValue = numberFromLine(normalized)
      return
    }

    if (/cost value/i.test(normalized) || /invested amount/i.test(normalized)) {
      draft ??= {
        fundFamily: currentFamily || 'Unknown Family',
        folio: currentFolio || 'N/A',
        schemeName: `Scheme @ ${currentFolio || 'N/A'}`,
        category: currentCategory,
      }
      draft.costValue = numberFromLine(normalized)
      commitDraft()
      return
    }

    if (/total\s+market\s+value/i.test(normalized)) {
      summaryTotals.marketValue = numberFromLine(normalized)
      return
    }

    if (/total\s+(cost|invested)/i.test(normalized)) {
      summaryTotals.costValue = numberFromLine(normalized)
    }
  })

  commitDraft()

  const holdings = scrubHoldings(
    Array.from(holdingsMap.entries()).map(([key, value]) => ({
      id: key,
      ...value,
    }))
  )

  if (!holdings.length) {
    throw new Error(
      'Unable to detect holdings in the uploaded CAS. Please ensure you selected a CAMS or KFintech statement.'
    )
  }

  const summary = summarizeHoldings(holdings)
  if (
    summaryTotals.marketValue &&
    Math.abs(summaryTotals.marketValue - summary.totalMarketValue) / summaryTotals.marketValue >
      tolerancePct
  ) {
    warnings.push(
      `Market value differs from CAS summary by ${formatDifference(
        summary.totalMarketValue - summaryTotals.marketValue
      )}.`
    )
  }

  if (
    summaryTotals.costValue &&
    Math.abs(summaryTotals.costValue - summary.totalCostValue) / summaryTotals.costValue >
      tolerancePct
  ) {
    warnings.push(
      `Invested amount differs from CAS summary by ${formatDifference(
        summary.totalCostValue - summaryTotals.costValue
      )}.`
    )
  }

  if (fileName && summary.holdingsCount > 50) {
    warnings.push('Large portfolio detected. Table pagination is enabled for better performance.')
  }

  return {
    holdings,
    summary,
    warnings,
  }
}

function scrubHoldings(holdings: PortfolioHolding[]): PortfolioHolding[] {
  return holdings
    .filter((holding) => (holding.marketValue ?? 0) >= PORTFOLIO_THRESHOLD)
    .map((holding) => ({
      ...holding,
      fundFamily: holding.fundFamily.trim(),
      schemeName: holding.schemeName.trim(),
      category: holding.category ?? 'Other',
      folio: holding.folio.trim(),
      units: holding.units ?? 0,
      nav: holding.nav ?? 0,
      marketValue: holding.marketValue ?? 0,
      costValue: holding.costValue ?? 0,
    }))
}

function summarizeHoldings(holdings: PortfolioHolding[]) {
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

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function formatDifference(value: number) {
  return `${formatter.format(Math.abs(value))} (${value > 0 ? '+' : '-'} vs CAS)`
}

export type { ParseResult }

