import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Rota de exemplo pra demonstrar a recuperação de sessão em 401 (JIRA-03).
// O middleware não redireciona chamadas de API — quem decide autorização
// aqui é a própria rota, lendo a sessão do cookie SSR.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ message: 'ok', userId: user.id, at: new Date().toISOString() })
}
