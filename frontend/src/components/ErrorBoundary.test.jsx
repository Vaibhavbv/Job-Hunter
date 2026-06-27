import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Bomb({ flag }) {
  if (flag.current) throw new Error('Boom')
  return <div>Safe content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error to the console — silence it for this test only.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb flag={{ current: false }} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Safe content')).toBeInTheDocument()
  })

  it('renders a fallback UI with the error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb flag={{ current: true }} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Boom')).toBeInTheDocument()
  })

  it('recovers and re-renders children after "Try Again" once the error condition clears', () => {
    const flag = { current: true }
    render(
      <ErrorBoundary>
        <Bomb flag={flag} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Simulate the underlying problem being resolved, then retry.
    flag.current = false
    fireEvent.click(screen.getByText('Try Again'))

    expect(screen.getByText('Safe content')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
