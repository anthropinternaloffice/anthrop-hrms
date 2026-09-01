import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'

/**
 * Entry point.
 *
 * The application is imported dynamically so that a configuration
 * mistake produces a sentence instead of a white screen. lib/env.ts
 * throws while its module is being evaluated — before React exists — so
 * no error boundary can catch it. This can.
 */
const container = document.getElementById('root')

if (!container) {
  throw new Error('No #root element. index.html has been changed.')
}

const root = createRoot(container)

import('@/App')
  .then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'The application failed to start.'

    // Plain DOM, no components: whatever broke may be why they cannot
    // render. The message is a setup instruction and carries no personal
    // data, so it is safe to put on screen (rule 7).
    root.render(
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          backgroundColor: '#f5f5f5',
          fontFamily: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: '32rem',
            border: '1px solid #d3d5d6',
            borderRadius: '0.375rem',
            backgroundColor: '#ffffff',
            padding: '1.5rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0a1119' }}>
            Anthrop HR could not start
          </h1>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#4b535d' }}>
            {message}
          </p>
        </div>
      </div>,
    )
  })
