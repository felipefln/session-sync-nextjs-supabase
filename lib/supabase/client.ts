import { createBrowserClient } from '@supabase/ssr'

// Singleton por aba: cada createBrowserClient() novo é um GoTrueClient
// independente, com seu próprio timer de auto-refresh. Múltiplas instâncias
// na mesma aba disputariam refresh entre si sem necessidade — centralizar
// aqui já elimina essa fonte de concorrência antes de tratar a coordenação
// entre abas diferentes.
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
