import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parseCasPdf, parseCasCsv, type ParseResult } from '@/lib/cas-parser'
import { downloadAnalysisCsv } from '@/lib/csv-export'
import {
  buildFundFamilySlices,
  calculateMetrics,
  enrichHoldings,
} from '@/lib/portfolio-metrics'
import type {
  CategoryFilter,
  FundFamilySlice,
  PortfolioAnalysis,
  PortfolioHoldingView,
} from './types'
import { LOCAL_STORAGE_KEY } from './constants'

export type PortfolioStatus = 'idle' | 'parsing' | 'ready' | 'error'

type PortfolioState = {
  status: PortfolioStatus
  statusMessage?: string
  error?: string
  categoryFilter: CategoryFilter
  currentAnalysis: PortfolioAnalysis | null
  holdingsView: PortfolioHoldingView[]
  fundFamilySlices: FundFamilySlice[]
  savedAnalyses: PortfolioAnalysis[]
  warnings: string[]
  selectedHistoryId?: string
  actions: {
    importPdf: (file: File) => Promise<void>
    importCsv: (input: string) => Promise<void>
    setCategoryFilter: (filter: CategoryFilter) => void
    loadAnalysis: (id: string) => void
    deleteAnalysis: (id: string) => void
    clearHistory: () => void
    exportCsv: () => void
    resetError: () => void
  }
}

const initialState = {
  status: 'idle' as PortfolioStatus,
  categoryFilter: 'All' as CategoryFilter,
  currentAnalysis: null,
  holdingsView: [] as PortfolioHoldingView[],
  fundFamilySlices: [] as FundFamilySlice[],
  savedAnalyses: [] as PortfolioAnalysis[],
  warnings: [] as string[],
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      ...initialState,
      actions: {
        importPdf: async (file: File) => {
          set({
            status: 'parsing',
            statusMessage: `Reading ${file.name}...`,
            error: undefined,
            warnings: [],
          })
          try {
            const result = await parseCasPdf(file)
            consumeParseResult(result, set, get, {
              label: friendlyLabel(file.name),
              fileName: file.name,
            })
          } catch (error) {
            console.error(error)
            set({
              status: 'error',
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to parse the uploaded CAS PDF.',
            })
          }
        },
        importCsv: async (input: string) => {
          set({
            status: 'parsing',
            statusMessage: 'Parsing CSV input...',
            error: undefined,
          })
          try {
            const result = parseCasCsv(input)
            consumeParseResult(result, set, get, {
              label: `Manual CSV (${new Date().toLocaleString()})`,
            })
          } catch (error) {
            console.error(error)
            set({
              status: 'error',
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to parse the provided CSV.',
            })
          }
        },
        setCategoryFilter: (filter: CategoryFilter) => {
          set({ categoryFilter: filter })
        },
        loadAnalysis: (id: string) => {
          const analysis = get().savedAnalyses.find((item) => item.id === id)
          if (!analysis) return
          const metrics = analysis.metrics
          const holdingsView = enrichHoldings(analysis.holdings, metrics.totalMarketValue)
          const fundFamilySlices = buildFundFamilySlices(
            analysis.holdings,
            metrics.totalMarketValue
          )
          set({
            currentAnalysis: analysis,
            holdingsView,
            fundFamilySlices,
            warnings: analysis.warnings,
            selectedHistoryId: id,
            status: 'ready',
            error: undefined,
          })
        },
        deleteAnalysis: (id: string) => {
          const next = get().savedAnalyses.filter((item) => item.id !== id)
          set({
            savedAnalyses: next,
          })
          if (get().currentAnalysis?.id === id) {
            set({
              currentAnalysis: null,
              holdingsView: [],
              fundFamilySlices: [],
              warnings: [],
              selectedHistoryId: undefined,
            })
          }
        },
        clearHistory: () => {
          set({
            savedAnalyses: [],
            currentAnalysis: null,
            holdingsView: [],
            fundFamilySlices: [],
            warnings: [],
            selectedHistoryId: undefined,
            status: 'idle',
          })
        },
        exportCsv: () => {
          const state = get()
          if (state.currentAnalysis) {
            downloadAnalysisCsv(state.currentAnalysis, state.holdingsView)
          }
        },
        resetError: () => set({ error: undefined, status: 'idle' }),
      },
    }),
    {
      name: LOCAL_STORAGE_KEY,
      partialize: (state) => ({
        savedAnalyses: state.savedAnalyses,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.savedAnalyses?.length && !state.currentAnalysis) {
          const mostRecent = state.savedAnalyses[0]
          const holdingsView = enrichHoldings(
            mostRecent.holdings,
            mostRecent.metrics.totalMarketValue
          )
          const fundFamilySlices = buildFundFamilySlices(
            mostRecent.holdings,
            mostRecent.metrics.totalMarketValue
          )
          state.currentAnalysis = mostRecent
          state.holdingsView = holdingsView
          state.fundFamilySlices = fundFamilySlices
          state.status = 'ready'
          state.selectedHistoryId = mostRecent.id
        }
      },
    }
  )
)

type ConsumeOptions = {
  label: string
  fileName?: string
}

function consumeParseResult(
  result: ParseResult,
  set: (partial: Partial<PortfolioState>) => void,
  get: () => PortfolioState,
  options: ConsumeOptions
) {
  const metrics = calculateMetrics(result.holdings)
  const holdingsView = enrichHoldings(result.holdings, metrics.totalMarketValue)
  const fundFamilySlices = buildFundFamilySlices(result.holdings, metrics.totalMarketValue)
  const analysis: PortfolioAnalysis = {
    id: crypto.randomUUID?.() ?? `analysis-${Date.now()}`,
    label: options.label,
    fileName: options.fileName,
    createdAt: Date.now(),
    holdings: result.holdings,
    metrics,
    warnings: result.warnings,
  }

  const saved = [analysis, ...get().savedAnalyses].slice(0, 15)

  set({
    currentAnalysis: analysis,
    holdingsView,
    fundFamilySlices,
    warnings: result.warnings,
    savedAnalyses: saved,
    selectedHistoryId: analysis.id,
    status: 'ready',
    statusMessage: undefined,
    error: undefined,
  })
}

function friendlyLabel(fileName?: string) {
  if (!fileName) return `CAS import (${new Date().toLocaleString()})`
  const base = fileName.replace(/\.[^.]+$/, '')
  return `${base} • ${new Date().toLocaleDateString()}`
}

