export function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-card">
        <h1 className="text-lg font-semibold text-ink">Configurazione mancante</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Crea un file <code className="rounded bg-quiet-bg px-1 py-0.5 text-ink">.env.local</code> con l’URL del
          progetto e la chiave anonima. La service role key non va mai messa qui.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-6 text-canvas">
{`VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=`}
        </pre>
      </div>
    </div>
  )
}
