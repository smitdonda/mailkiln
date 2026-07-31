/**
 * Test setup.
 *
 * Ids are sequential and the counter is module-global, so every test file resets
 * it — otherwise renderer snapshots depend on which tests ran first.
 */

import { afterEach, beforeEach } from 'vitest'
import { resetIds } from '../src/core/index.js'

beforeEach(() => {
  resetIds()
})

afterEach(() => {
  resetIds()
})
