import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./session-sync', () => ({
  refreshSessionCoordinated: vi.fn(),
}))

import { refreshSessionCoordinated } from './session-sync'
import { fetchWithAuth, SessionExpiredError } from './fetch-with-auth'

const refreshMock = vi.mocked(refreshSessionCoordinated)

describe('fetchWithAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns the response as-is when the status is not 401', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))

    const result = await fetchWithAuth('/api/whatever')

    expect(result.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('on 401, recovers the session and retries the request once', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    refreshMock.mockResolvedValue(undefined as never)

    const result = await fetchWithAuth('/api/whatever')

    expect(result.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('throws SessionExpiredError without retrying when the refresh itself fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    refreshMock.mockRejectedValue(new Error('refresh token invalid'))

    await expect(fetchWithAuth('/api/whatever')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws SessionExpiredError when the retry after a successful refresh still 401s', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    refreshMock.mockResolvedValue(undefined as never)

    await expect(fetchWithAuth('/api/whatever')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
