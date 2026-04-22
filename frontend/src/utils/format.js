/**
 * Shared utility functions used across the app.
 * Extracted from duplicated copies in JobCard, JobsBoard, Dashboard, ResumeUpload.
 */

/**
 * Generate a stable HSL color from a string (company name).
 */
export function hashColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 45%)`
}

/**
 * Get up to 2-letter initials from a name.
 */
export function initials(name) {
  return name
    .split(/[\s&,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/**
 * Format a date string into a relative label (Today, 1d ago, 2w ago, etc.)
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return '1d ago'
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Truncate salary to max length with ellipsis.
 */
export function formatSalary(s) {
  if (!s) return '—'
  return s.length > 30 ? s.slice(0, 28) + '…' : s
}

/**
 * Truncate any string to a given length with ellipsis.
 */
export function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

/**
 * Get color for a relevancy score (green / yellow / orange / red).
 */
export function scoreColor(score) {
  if (score >= 75) return '#00ff88'
  if (score >= 50) return '#fbbf24'
  if (score >= 25) return '#f97316'
  return '#ef4444'
}

/**
 * Get label for a relevancy score.
 */
export function scoreLabel(score) {
  if (score >= 75) return 'Excellent'
  if (score >= 50) return 'Good'
  if (score >= 25) return 'Fair'
  return 'Low'
}
