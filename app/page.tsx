import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './sign-out-button'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="page-shell">
      <div className="top-bar">
        <div>
          <h1>Session Sync Next.js Supabase</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Sessão SSR com @supabase/ssr
          </p>
        </div>
        <div className="user-chip">
          {user?.email}
          <SignOutButton />
        </div>
      </div>

      <section className="panel">
        <h2>Demonstração multi-aba</h2>
        <p className="subtitle">
          Coordenação de refresh entre abas e recuperação de sessão em 401, com log de eventos ao
          vivo.
        </p>
        <Link href="/demo" className="btn btn-primary" style={{ display: 'inline-block' }}>
          Abrir demo
        </Link>
      </section>
    </main>
  )
}
