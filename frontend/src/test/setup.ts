import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// globals: false means Testing Library's auto-cleanup never fires (it detects
// a global `afterEach`), so unmount rendered components after every test here.
afterEach(() => {
  cleanup()
})
