import { createFileRoute } from '@tanstack/react-router'
import { AnalyzerPage } from '@/features/portfolio'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/')({
  component: () => (
    <AuthenticatedLayout>
      <AnalyzerPage />
    </AuthenticatedLayout>
  ),
})

