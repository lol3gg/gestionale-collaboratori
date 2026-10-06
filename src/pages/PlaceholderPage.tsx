import { PageHeader } from '../components/layout/PageHeader'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <PageHeader title={title} />
      <p className="text-sm text-slate-500">In arrivo</p>
    </section>
  )
}
