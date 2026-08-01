import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './sign-out-button'
import { ProtectedDemo } from './protected-demo'

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

      <ProtectedDemo />
    </main>
  )
}
