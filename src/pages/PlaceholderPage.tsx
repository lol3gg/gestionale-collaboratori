import { PageHeader } from '../components/layout/PageHeader'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <PageHeader title={title} />
      <p className="text-sm text-muted">In arrivo</p>
    </section>
  )
}
