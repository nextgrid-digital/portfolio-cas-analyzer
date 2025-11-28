import { useMemo, useRef, useState } from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { AlertCircle, AlertTriangle, Download, FileDown, History, Loader2, Trash2, Upload } from 'lucide-react'
import { DataTableColumnHeader, DataTablePagination } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePortfolioStore, type PortfolioStatus } from '../use-portfolio-store'
import type {
  CategoryFilter,
  FundFamilySlice,
  PortfolioAnalysis,
  PortfolioHoldingView,
} from '../types'
import { ASSET_CATEGORIES } from '../constants'

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const decimal = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
})

export function AnalyzerDashboard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const status = usePortfolioStore((state) => state.status)
  const statusMessage = usePortfolioStore((state) => state.statusMessage)
  const error = usePortfolioStore((state) => state.error)
  const warnings = usePortfolioStore((state) => state.warnings)
  const categoryFilter = usePortfolioStore((state) => state.categoryFilter)
  const currentAnalysis = usePortfolioStore((state) => state.currentAnalysis)
  const holdingsView = usePortfolioStore((state) => state.holdingsView)
  const fundFamilySlices = usePortfolioStore((state) => state.fundFamilySlices)
  const savedAnalyses = usePortfolioStore((state) => state.savedAnalyses)
  const selectedHistoryId = usePortfolioStore((state) => state.selectedHistoryId)
  const actions = usePortfolioStore((state) => state.actions)

  const filteredHoldings = useMemo(() => {
    if (categoryFilter === 'All') return holdingsView
    return holdingsView.filter((holding) => holding.category === categoryFilter)
  }, [categoryFilter, holdingsView])

  const columns = useMemo<ColumnDef<PortfolioHoldingView>[]>(
    () => [
      {
        accessorKey: 'fundFamily',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Fund Family' />
        ),
        cell: ({ row }) => (
          <div className='max-w-[220px] truncate font-medium'>{row.original.fundFamily}</div>
        ),
      },
      {
        accessorKey: 'schemeName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Scheme' />
        ),
        cell: ({ row }) => (
          <div className='max-w-[240px] truncate text-sm'>{row.original.schemeName}</div>
        ),
      },
      {
        accessorKey: 'folio',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Folio' />
        ),
        cell: ({ row }) => <span className='text-xs text-muted-foreground'>{row.original.folio}</span>,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => <Badge variant='outline'>{row.original.category}</Badge>,
      },
      {
        accessorKey: 'units',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Units' />
        ),
        cell: ({ row }) => <span>{decimal.format(row.original.units)}</span>,
        meta: { align: 'right' },
      },
      {
        accessorKey: 'nav',
        header: ({ column }) => <DataTableColumnHeader column={column} title='NAV' />,
        cell: ({ row }) => <span>{decimal.format(row.original.nav)}</span>,
        meta: { align: 'right' },
      },
      {
        accessorKey: 'marketValue',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Market Value' />
        ),
        cell: ({ row }) => <span>{currency.format(row.original.marketValue)}</span>,
        meta: { align: 'right' },
      },
      {
        accessorKey: 'costValue',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Cost Value' />
        ),
        cell: ({ row }) => <span>{currency.format(row.original.costValue)}</span>,
        meta: { align: 'right' },
      },
      {
        accessorKey: 'gainLoss',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Gain / Loss' />
        ),
        cell: ({ row }) => (
          <span className={row.original.gainLoss >= 0 ? 'text-emerald-600' : 'text-destructive'}>
            {currency.format(row.original.gainLoss)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'returnPercent',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Return %' />
        ),
        cell: ({ row }) => (
          <span className={row.original.returnPercent >= 0 ? 'text-emerald-600' : 'text-destructive'}>
            {decimal.format(row.original.returnPercent)}%
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'allocationPercent',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Allocation %' />
        ),
        cell: ({ row }) => <span>{decimal.format(row.original.allocationPercent)}%</span>,
        meta: { align: 'right' },
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredHoldings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 15 },
    },
  })

  return (
    <div className='space-y-6 px-4 py-6 lg:px-8'>
      <header className='space-y-2'>
        <Card className='border-primary/20 bg-gradient-to-br from-cyan-900/70 via-primary/20 to-background text-primary-foreground overflow-hidden'>
          <CardHeader className='space-y-1'>
            <CardTitle className='text-2xl font-semibold'>
              MF Portfolio CAS Analyzer
            </CardTitle>
            <CardDescription className='text-primary-foreground/80'>
              Convert CAMS / KFintech CAS PDFs into actionable, client-ready insights without
              uploading data to a server.
            </CardDescription>
          </CardHeader>
        </Card>
      </header>

      <section className='grid gap-4 lg:grid-cols-3'>
        <UploadPanel inputRef={inputRef} status={status} statusMessage={statusMessage} error={error} />
        <HistoryPanel
          analyses={savedAnalyses}
          selectedId={selectedHistoryId}
          onSelect={actions.loadAnalysis}
          onDelete={actions.deleteAnalysis}
          onClear={actions.clearHistory}
        />
      </section>

      {warnings.length > 0 && (
        <Alert variant='warning'>
          <AlertTriangle className='size-4' />
          <AlertTitle>Validation warnings</AlertTitle>
          <AlertDescription>
            <ul className='list-disc pl-4 space-y-1'>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <MetricsSummary status={status} analysis={currentAnalysis} onExport={actions.exportCsv} />

      <section className='grid gap-4 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
            <div>
              <CardTitle>Holdings</CardTitle>
              <CardDescription>Sortable, filterable view of every scheme.</CardDescription>
            </div>

            <div className='flex flex-wrap gap-3'>
              <Select
                value={categoryFilter}
                onValueChange={(value: CategoryFilter) => actions.setCategoryFilter(value)}
              >
                <SelectTrigger className='w-[180px]'>
                  <SelectValue placeholder='Category filter' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key='All' value='All'>
                    All categories
                  </SelectItem>
                  {ASSET_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant='outline' size='sm' onClick={actions.exportCsv} disabled={!currentAnalysis}>
                <Download className='mr-2 size-4' />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {status === 'parsing' ? (
              <TableSkeleton />
            ) : filteredHoldings.length === 0 ? (
              <EmptyState />
            ) : (
              <div className='space-y-4'>
                <div className='overflow-x-auto rounded-md border'>
                  <table className='w-full text-sm'>
                    <thead className='bg-muted/50'>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className={cn(
                                'px-3 py-2 text-left font-medium',
                                header.column.columnDef.meta?.align === 'right' && 'text-right'
                              )}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className='border-t'>
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className={cn(
                                'px-3 py-2 align-top',
                                cell.column.columnDef.meta?.align === 'right' && 'text-right'
                              )}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DataTablePagination table={table} />
              </div>
            )}
          </CardContent>
        </Card>

        <FundFamilyBreakdown slices={fundFamilySlices} />
      </section>
    </div>
  )
}

type UploadPanelProps = {
  inputRef: React.RefObject<HTMLInputElement>
  status: PortfolioStatus
  statusMessage?: string
  error?: string
}

function UploadPanel({ inputRef, status, statusMessage, error }: UploadPanelProps) {
  const { importPdf, importCsv, resetError } = usePortfolioStore((state) => state.actions)
  const [csvInput, setCsvInput] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file?: File | null) => {
    if (!file) return
    resetError()
    const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
    if (isPdf) {
      importPdf(file)
      return
    }

    const isCsv = file.type.includes('csv') || file.name.toLowerCase().endsWith('.csv')
    if (isCsv) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          importCsv(reader.result)
        }
      }
      reader.readAsText(file)
      return
    }

    toast.error('Unsupported file type. Upload a CAS PDF or provide CSV data.')
  }

  return (
    <Card className='lg:col-span-2'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Upload className='size-4 text-primary' />
          Upload CAS PDF
        </CardTitle>
        <CardDescription>
          Drag & drop a CAMS or KFintech CAS PDF. Parsing is executed entirely in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            const file = event.dataTransfer.files?.[0]
            handleFile(file)
          }}
          className={cn(
            'border-dashed rounded-lg border-2 p-6 text-center transition',
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
          )}
        >
          <input
            ref={inputRef}
            type='file'
            accept='application/pdf'
            className='hidden'
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <p className='text-sm text-muted-foreground'>
            Drop your CAS PDF here, or{' '}
            <button
              type='button'
              className='text-primary underline underline-offset-4'
              onClick={() => inputRef.current?.click()}
            >
              browse files
            </button>
          </p>
        </div>

        {status === 'parsing' && (
          <Alert>
            <Loader2 className='size-4 animate-spin' />
            <AlertTitle>Processing</AlertTitle>
            <AlertDescription>{statusMessage ?? 'Extracting holdings...'}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant='destructive'>
            <AlertCircle className='size-4' />
            <AlertTitle>Parsing failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className='rounded-lg border bg-muted/40 p-4'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            <FileDown className='size-4' />
            Manual CSV fallback
          </div>
          <p className='text-xs text-muted-foreground mt-1'>
            Paste CSV data with columns: fundFamily, folio, schemeName, category, units, nav, marketValue, costValue.
          </p>
          <Textarea
            value={csvInput}
            onChange={(event) => setCsvInput(event.target.value)}
            className='mt-3 min-h-[120px]'
            placeholder='fundFamily,folio,schemeName,category,units,nav,marketValue,costValue'
          />
          <div className='mt-3 flex justify-end'>
            <Button
              size='sm'
              onClick={() => {
                resetError()
                importCsv(csvInput)
              }}
              disabled={!csvInput.trim()}
            >
              Parse CSV
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type HistoryPanelProps = {
  analyses: PortfolioAnalysis[]
  selectedId?: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClear: () => void
}

function HistoryPanel({ analyses, selectedId, onSelect, onDelete, onClear }: HistoryPanelProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <div>
          <CardTitle className='text-lg'>Saved Analyses</CardTitle>
          <CardDescription>Stored securely in this browser.</CardDescription>
        </div>
        <History className='size-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        {analyses.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Nothing saved yet. Every new parse is remembered automatically.
          </p>
        ) : (
          <ScrollArea className='h-[260px] pr-2'>
            <div className='space-y-2'>
              {analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className={cn(
                    'rounded-md border p-3 transition hover:border-primary/60',
                    selectedId === analysis.id && 'border-primary bg-primary/5'
                  )}
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='font-medium'>{analysis.label}</p>
                      <p className='text-xs text-muted-foreground'>
                        {new Date(analysis.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className='flex gap-2'>
                      <Button size='sm' variant='secondary' onClick={() => onSelect(analysis.id)}>
                        Load
                      </Button>
                      <Button
                        size='icon'
                        variant='ghost'
                        className='text-destructive'
                        onClick={() => onDelete(analysis.id)}
                      >
                        <span className='sr-only'>Delete analysis</span>
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  </div>
                  <p className='text-xs text-muted-foreground mt-1'>
                    {currency.format(analysis.metrics.totalMarketValue)} ·{' '}
                    {analysis.metrics.holdingsCount} holdings
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        {analyses.length > 0 && (
          <Button variant='outline' size='sm' className='mt-3 w-full' onClick={onClear}>
            Clear history
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

type MetricsProps = {
  status: PortfolioStatus
  analysis: PortfolioAnalysis | null
  onExport: () => void
}

function MetricsSummary({ status, analysis, onExport }: MetricsProps) {
  const metrics = analysis?.metrics
  const cards = [
    {
      label: 'Portfolio Value',
      value: metrics ? currency.format(metrics.totalMarketValue) : '—',
    },
    {
      label: 'Invested Amount',
      value: metrics ? currency.format(metrics.totalCostValue) : '—',
    },
    {
      label: 'Gain / Loss',
      value: metrics ? currency.format(metrics.gainLossValue) : '—',
      trend: metrics ? `${decimal.format(metrics.gainLossPercent)}%` : undefined,
      positive: (metrics?.gainLossValue ?? 0) >= 0,
    },
    {
      label: 'Active Holdings',
      value: metrics ? decimal.format(metrics.holdingsCount) : '—',
    },
  ]
  return (
    <section className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className='pb-2'>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className='text-2xl'>
              {status === 'parsing' ? <Skeleton className='h-7 w-24' /> : card.value}
            </CardTitle>
          </CardHeader>
          {card.trend && (
            <CardContent>
              <p
                className={cn(
                  'text-sm font-medium',
                  card.positive ? 'text-emerald-600' : 'text-destructive'
                )}
              >
                {card.trend}
              </p>
            </CardContent>
          )}
        </Card>
      ))}
    </section>
  )
}

type BreakdownProps = {
  slices: FundFamilySlice[]
}

function FundFamilyBreakdown({ slices }: BreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund Family Breakdown</CardTitle>
        <CardDescription>Spot concentration above 20% per family.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {slices.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Upload a CAS to see allocation by fund house.
          </p>
        ) : (
          <div className='space-y-4'>
            {slices.map((slice) => (
              <div key={slice.fundFamily} className='space-y-1'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='font-medium'>{slice.fundFamily}</span>
                  <span>{decimal.format(slice.allocationPercent)}%</span>
                </div>
                <div className='h-2 rounded-full bg-muted'>
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      slice.allocationPercent > 20 ? 'bg-destructive' : 'bg-primary'
                    )}
                    style={{ width: `${slice.allocationPercent}%` }}
                  />
                </div>
                {slice.allocationPercent > 20 && (
                  <p className='text-xs text-muted-foreground'>
                    Concentration warning: consider trimming exposure.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <div className='space-y-2'>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className='h-10 w-full' />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className='flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground'>
      <p>Upload a CAS PDF to see holdings here.</p>
    </div>
  )
}

