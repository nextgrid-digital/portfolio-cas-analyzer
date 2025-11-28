# MF Portfolio CAS Analyzer

Client-side mutual fund portfolio analyzer that converts CAMS/KFintech consolidated account statements (CAS) into actionable dashboards. Upload a CAS PDF (or fallback CSV), review holdings, highlight concentrations, export reports, and persist analyses locally—no authentication, no servers.

![MF Portfolio CAS Analyzer](public/images/shadcn-admin.png)

## Key Capabilities

- **Private PDF parsing** – pdf.js extracts CAS text in-browser and a state-machine parser deduplicates holdings on `fundFamily|folio|scheme`.
- **Portfolio analytics** – instant totals for market value, invested capital, gain/loss amounts, and active holding counts.
- **Rich holdings table** – sortable columns (family, scheme, folio, units, NAV, value, cost, gain, returns, allocation) with category filters and pagination for large portfolios.
- **Fund-family concentration** – allocation bars flag exposures above 20% to simplify risk reviews.
- **Local persistence** – every run is cached with timestamps in `localStorage`; quickly load/delete past analyses per browser.
- **Exports & sharing** – one-click CSV export containing holdings plus high-level summary, suitable for compliance-ready reporting.
- **Manual fallback** – paste a CSV with headers (`fundFamily, folio, schemeName, category, units, nav, marketValue, costValue`) if a PDF is unavailable.
- **Accessible teal-blue UX** – responsive layout, keyboard-friendly controls, descriptive alerts, and system theme support.

## How to Use

1. Launch the app (`pnpm dev`) and open `http://localhost:5173`.
2. Drag a CAMS/KFintech CAS PDF into the upload panel (data never leaves the browser).
3. Watch progress + validation alerts. If the CAS summary deviates by more than ±2%, a warning is displayed.
4. Explore metrics, filter holdings by asset class, and review fund-family breakdowns.
5. Export CSV data or switch between saved analyses from the sidebar history panel.
6. Need a fallback? Paste CSV data into the manual parser and click **Parse CSV**.

## Tech Stack

- **UI** – Shadcn UI, Radix Primitives, Tailwind CSS tokens
- **State** – Zustand (persisted to `localStorage`)
- **Routing** – TanStack Router with file-based routes
- **Tables & Charts** – TanStack Table, custom breakdown visualizations
- **PDF parsing** – pdf.js (`pdfjs-dist`)
- **Tooling** – Vite, TypeScript, ESLint, Prettier

## Local Development

```bash
# install dependencies
corepack pnpm install

# start dev server
corepack pnpm dev
```

Visit `http://localhost:5173`. The TanStack Router plugin regenerates `src/routeTree.gen.ts` on boot.

## Data Privacy

- No authentication or backend services — everything runs inside the browser tab.
- CAS files are parsed entirely in-memory and can be cleared any time via the saved analyses panel.

## License

MIT — adapted from the original shadcn-admin boilerplate.
