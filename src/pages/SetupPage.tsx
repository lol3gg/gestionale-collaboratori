export function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Configurazione mancante</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Crea un file <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code> con l’URL del progetto e la
          chiave anonima. La service role key non va mai messa qui.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-100">
{`VITE_SUPABASE_URL=https://oswopperbawdkyyeyfhm.supabase.co
VITE_SUPABASE_ANON_KEY=la-chiave-anon`}
        </pre>
      </div>
    </div>
  )
}
