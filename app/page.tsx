import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main style={{ padding: '3rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Session Sync Next.js Supabase</h1>
      <p>Logado como: {user?.email}</p>
      <form action="/auth/signout" method="post">
        <button type="submit">Sair</button>
      </form>
    </main>
  )
}
