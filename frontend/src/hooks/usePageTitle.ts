import { useEffect } from 'react'

/**
 * Per-route <title> + meta description for the public/SEO-facing pages.
 * (An SPA can't give crawlers per-route server-rendered meta without
 * prerendering — that's the programmatic-SEO scaffold in ROADMAP Phase B —
 * but titles/descriptions still matter for the pages Google does render.)
 */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title
    if (description) {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (meta) meta.content = description
    }
  }, [title, description])
}
