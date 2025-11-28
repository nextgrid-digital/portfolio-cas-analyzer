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

export const SAMPLE_CSV_DATA = `fundFamily,folio,schemeName,category,units,nav,marketValue,costValue
ICICI Prudential Mutual Fund,13386298/76,ICICI Prudential Nifty Next 50 Fund-Direct Growth,Equity,250.5,180.50,45240.25,45000
Edelweiss Mutual Fund,6018449/39,Edelweiss Growth Opportunities Fund-Direct Plan-Growth,Equity,180.75,320.25,57905.19,58000
Bharat Mutual Fund,22065936/0,Bharat Value Fund-Direct Growth,Equity,150,1050.75,157612.50,150000
SBI Mutual Fund,77718291786/0,SBI Liquid Fund-Direct Growth,Debt,2000,1020.35,2040700.00,2040000
ICICI Prudential Mutual Fund,13386298/76,ICICI Prudential Gilt Fund-Direct Growth,Debt,500,1100.00,550000.00,550000
Motilal Oswal Mutual Fund,22422074,Motilal Oswal Gold Direct Fund,Gold,100,150.25,15025.00,15000`

