import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('table states', () => {
  test('state computation exports exist', async () => {
    const { getTableState } = await import('../src/services/tables.js')
    assert.equal(typeof getTableState, 'function')
  })
})
