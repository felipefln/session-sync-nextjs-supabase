import { describe, expect, it } from 'vitest'
import { fromBase64Url, tamperSignature, toBase64Url } from './demo-corrupt-session'

describe('base64url round-trip', () => {
  it('encodes and decodes back to the original string', () => {
    const original = JSON.stringify({ access_token: 'abc.def.ghi', refresh_token: 'xyz' })
    expect(fromBase64Url(toBase64Url(original))).toBe(original)
  })

  it('produces url-safe output (no +, / or padding)', () => {
    // bytes escolhidos pra forçar os caracteres que o base64 padrão usaria
    const encoded = toBase64Url('\xfb\xff\xbf?>')
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('tamperSignature', () => {
  it('changes only the signature segment of a JWT-shaped token', () => {
    const token = 'header.payload.signature'
    const tampered = tamperSignature(token)

    const [header, payload, signature] = tampered.split('.')
    expect(header).toBe('header')
    expect(payload).toBe('payload')
    expect(signature).not.toBe('signature')
    expect(signature).toHaveLength('signature'.length)
  })

  it('is idempotent-safe: tampering twice still yields a value different from the original', () => {
    const token = 'header.payload.signature'
    const tamperedTwice = tamperSignature(tamperSignature(token))
    expect(tamperedTwice).not.toBe(token)
  })

  it('returns the input unchanged when it is not a 3-part JWT', () => {
    expect(tamperSignature('not-a-jwt')).toBe('not-a-jwt')
  })
})
