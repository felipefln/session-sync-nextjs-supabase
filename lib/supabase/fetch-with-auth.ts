'use client'

import { refreshSessionCoordinated } from './session-sync'

export class SessionExpiredError extends Error {
  constructor() {
    super('Sessão expirada: não foi possível recuperar após o refresh.')
    this.name = 'SessionExpiredError'
  }
}

/**
 * fetch() que trata 401 como recuperável em vez de logout imediato: tenta
 * renovar a sessão (coordenado com outras abas via lock, JIRA-02) e refaz a
 * requisição uma única vez antes de desistir. Só quando o refresh também
 * falha é que a sessão é considerada realmente expirada.
 */
export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if (response.status !== 401) return response

  try {
    await refreshSessionCoordinated()
  } catch {
    throw new SessionExpiredError()
  }

  const retry = await fetch(input, init)
  if (retry.status === 401) throw new SessionExpiredError()

  return retry
}
