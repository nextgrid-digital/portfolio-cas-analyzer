import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  GlobalWorkerOptions,
  type PDFDocumentProxy,
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

type PdfTextItem = {
  str: string
  x: number
  y: number
  width: number
}

type PdfLine = {
  y: number
  items: PdfTextItem[]
  text: string
}

const tolerancePct = 0.02
const Y_TOLERANCE = 1.5
const X_GAP_THRESHOLD = 6

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
      category: inferCategory(get('category')),
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

async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const data = await file.arrayBuffer()
  return getDocument({ data }).promise
}

async function extractLines(pdf: PDFDocumentProxy): Promise<PdfLine[]> {
  const lineBuckets = new Map<number, PdfLine>()

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const content = await page.getTextContent()

    content.items.forEach((item: any) => {
      const raw = String(item.str ?? '').trim()
      if (!raw) return

      const transform: number[] = item.transform ?? []
      const x = transform[4] ?? 0
      const y = transform[5] ?? 0
      const width = item.width ?? 0

      const lineKey = Math.round(y / Y_TOLERANCE)
      const bucket = lineBuckets.get(lineKey)

      if (bucket) {
        bucket.items.push({ str: raw, x, y, width })
      } else {
        lineBuckets.set(lineKey, {
          y,
          items: [{ str: raw, x, y, width }],
          text: '',
        })
      }
    })
  }

  const lines = Array.from(lineBuckets.values()).map((line) => {
    const sortedItems = [...line.items].sort((a, b) => a.x - b.x)
    const textParts: string[] = []

    let prevRight = Number.NEGATIVE_INFINITY
    sortedItems.forEach((item) => {
      const gap = item.x - prevRight
      if (gap > X_GAP_THRESHOLD) {
        textParts.push(' ')
      } else if (textParts.length && !textParts[textParts.length - 1].endsWith(' ')) {
        textParts.push(' ')
      }

      textParts.push(item.str)
      prevRight = item.x + (item.width ?? 0)
    })

    const text = textParts.join('').replace(/\s+/g, ' ').trim()
    return {
      ...line,
      items: sortedItems,
      text,
    }
  })

  return lines
    .filter((line) => line.text.length > 0)
    .sort((a, b) => b.y - a.y)
}

function parseCasLines(lines: PdfLine[], fileName?: string): ParseResult {
  const warnings: string[] = []
  const holdings = parseHoldings(lines, warnings)

  if (!holdings.length) {
    throw new Error(
      'Unable to detect holdings in the uploaded CAS. Please ensure you selected a CAMS or KFintech statement.'
    )
  }

  const summary = summarizeHoldings(holdings)
  const declaredTotals = parsePortfolioSummary(lines)

  if (declaredTotals) {
    const { totalMarketValue, totalCostValue } = declaredTotals

    if (
      totalMarketValue &&
      Math.abs(totalMarketValue - summary.totalMarketValue) / totalMarketValue > tolerancePct
    ) {
      warnings.push(
        `Market value differs from CAS summary by ${formatDifference(
          summary.totalMarketValue - totalMarketValue
        )}.`
      )
    }

    if (
      totalCostValue &&
      Math.abs(totalCostValue - summary.totalCostValue) / totalCostValue > tolerancePct
    ) {
      warnings.push(
        `Invested amount differs from CAS summary by ${formatDifference(
          summary.totalCostValue - totalCostValue
        )}.`
      )
    }
  } else {
    warnings.push('Unable to parse portfolio summary totals for validation.')
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

function parsePortfolioSummary(
  lines: PdfLine[]
): { totalMarketValue?: number; totalCostValue?: number } | null {
  const startIndex = lines.findIndex((line) => /portfolio summary/i.test(line.text))
  if (startIndex === -1) return null

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const text = lines[i].text
    if (!text || /date\s+transaction/i.test(text)) break
    const totalMatch = text.match(/^Total\s+([\d,().-]+)\s+([\d,().-]+)$/i)
    if (totalMatch) {
      return {
        totalCostValue: parseNumber(totalMatch[1]),
        totalMarketValue: parseNumber(totalMatch[2]),
      }
    }
  }

  return null
}

function parseHoldings(lines: PdfLine[], warnings: string[]): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = []

  let currentFund = ''
  let currentFolio: { number: string; pan?: string } | null = null
  let currentScheme: { name: string; isin?: string; category: AssetCategory } | null = null

  const pushHolding = (closingLine: string) => {
    if (!currentFund || !currentFolio || !currentScheme) {
      warnings.push(
        `Detected closing balance but missing context (fund: ${currentFund || '-'}, folio: ${
          currentFolio?.number ?? '-'
        }, scheme: ${currentScheme?.name ?? '-'})`
      )
      return
    }

    const units = extractLabelNumber(closingLine, 'Closing Unit Balance')
    const nav = extractLabelNumber(closingLine, 'NAV')
    const costValue = extractLabelNumber(closingLine, 'Total Cost Value')
    const marketValue = extractLabelNumber(closingLine, 'Market Value')

    if (
      units === undefined ||
      nav === undefined ||
      costValue === undefined ||
      marketValue === undefined
    ) {
      warnings.push(`Incomplete closing balance data for scheme "${currentScheme.name}".`)
      return
    }

    const id = `${currentFund}|${currentFolio.number}|${currentScheme.name}|${currentScheme.isin ?? ''}`

    holdings.push({
      id,
      fundFamily: currentFund,
      folio: currentFolio.number,
      schemeName: currentScheme.name,
      category: currentScheme.category,
      units,
      nav,
      costValue,
      marketValue,
    })

    currentScheme = null
  }

  lines.forEach((line) => {
    const text = line.text

    if (isFundHeader(text)) {
      currentFund = text.replace(/Mutual Fund/i, '').trim() || text.trim()
      return
    }

    if (text.includes('Folio No')) {
      currentFolio = {
        number: extractFolioNumber(text) ?? 'Unknown Folio',
        pan: extractPan(text),
      }
      return
    }

    if (text.includes('ISIN')) {
      currentScheme = parseSchemeLine(text)
      return
    }

    if (/Closing Unit Balance/i.test(text)) {
      pushHolding(text)
      return
    }
  })

  return scrubHoldings(holdings)
}

function isFundHeader(text: string) {
  return /Mutual Fund$/i.test(text.trim()) && !/PORTFOLIO SUMMARY/i.test(text)
}

function extractFolioNumber(text: string) {
  const match = text.match(/Folio No:\s*([^|]+)/i)
  return match ? match[1].trim() : null
}

function extractPan(text: string) {
  const match = text.match(/PAN:\s*([A-Z0-9]+)/i)
  return match ? match[1].trim() : undefined
}

function parseSchemeLine(text: string) {
  const [rawName] = text.split(/ISIN:/i)
  const schemeName = cleanSchemeName(rawName ?? text)
  const isinMatch = text.match(/ISIN:\s*([A-Z0-9]+)/i)
  return {
    name: schemeName,
    isin: isinMatch?.[1],
    category: inferCategory(schemeName),
  }
}

function cleanSchemeName(raw: string) {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  const withoutCode = trimmed.replace(/^[A-Z0-9]+\s*[-–]\s*/i, '')
  return withoutCode || trimmed
}

function inferCategory(value?: string | null): AssetCategory {
  const name = value?.toLowerCase() ?? ''
  if (/gold/.test(name)) return 'Gold'
  if (/(liquid|overnight|income|bond|gilt|debt|money market)/.test(name)) return 'Debt'
  if (/(hybrid|balanced|asset allocator|multi asset)/.test(name)) return 'Hybrid'
  if (/(equity|large cap|midcap|small cap|flexi|value|focused|elss|tax saver)/.test(name))
    return 'Equity'
  return 'Other'
}

function extractLabelNumber(text: string, label: string) {
  const regex = new RegExp(`${label}\\s*:?\\s*(?:INR\\s*)?([\\d,().-]+)`, 'i')
  const match = text.match(regex)
  return match ? parseNumber(match[1]) : undefined
}

function parseNumber(raw?: string) {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const negative = trimmed.startsWith('(') && trimmed.endsWith(')')
  const normalized = trimmed.replace(/[(),\s]/g, '')
  if (!normalized) return undefined

  const value = Number.parseFloat(normalized)
  return negative ? -value : value
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

