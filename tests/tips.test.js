import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('tips service', () => {
  test('service exports exist', async () => {
    const tips = await import('../src/services/tips.js')
    assert.equal(typeof tips.recordTip, 'function')
    assert.equal(typeof tips.distributePool, 'function')
    assert.equal(typeof tips.getTipsReport, 'function')
  })
})
