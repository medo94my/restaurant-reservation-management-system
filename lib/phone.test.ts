import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePhone } from './phone.ts'
import { normalizePhone as customerNormalizePhone } from './customer-service.ts'

test('normalizePhone - canonical export is shared across lib/phone.ts and lib/customer-service.ts', () => {
  assert.strictEqual(customerNormalizePhone, normalizePhone)
})

test('normalizePhone - strips non-digit characters from formatted phone numbers', () => {
  assert.equal(normalizePhone('+961 70 123 456'), '96170123456')
  assert.equal(normalizePhone('+1 (555) 234-5678'), '15552345678')
  assert.equal(normalizePhone('123-456-7890'), '1234567890')
  assert.equal(normalizePhone('(01) 234 567'), '01234567')
  assert.equal(normalizePhone('  +44 20 7946 0919  '), '442079460919')
})

test('normalizePhone - preserves already normalized numeric strings', () => {
  assert.equal(normalizePhone('96170123456'), '96170123456')
  assert.equal(normalizePhone('0123456789'), '0123456789')
})

test('normalizePhone - handles empty, blank, and invalid inputs gracefully', () => {
  assert.equal(normalizePhone(''), '')
  assert.equal(normalizePhone('   '), '')
  assert.equal(normalizePhone('---'), '')
  assert.equal(normalizePhone('abc!@#$'), '')
  assert.equal(normalizePhone(null), '')
  assert.equal(normalizePhone(undefined), '')
  assert.equal(normalizePhone(12345 as unknown as string), '')
})
