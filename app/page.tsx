import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './sign-out-button'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main style={{ padding: '3rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Session Sync Next.js Supabase</h1>
      <p>Logado como: {user?.email}</p>
      <SignOutButton />
    </main>
  )
}
