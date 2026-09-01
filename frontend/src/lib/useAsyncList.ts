import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'

type Loader<T> = () => Promise<{ data: T[] | null; error: PostgrestError | null }>

export interface AsyncList<T> {
  /** Null means "not loaded yet"; an empty array means "loaded, nothing there". */
  items: T[] | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
}

/**
 * Loads a list once, and again on demand after a write.
 *
 * The distinction between `null` and `[]` is the point of this hook.
 * "Still loading" and "there are none" look identical if both are an
 * empty array, and an empty state that flashes up before the data
 * arrives tells the user something untrue.
 *
 * `load` must be a stable reference — pass a module-level function, not
 * an inline arrow, or this will refetch on every render.
 */
export function useAsyncList<T>(load: Loader<T>): AsyncList<T> {
  const [items, setItems] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await load()

    if (loadError) {
      // Nothing is logged: a PostgREST error can quote the offending row
      // and that row may be personal data (rule 7).
      setError('That list could not be loaded. Check your connection and try again.')
      setLoading(false)
      return
    }

    setItems(data ?? [])
    setError(null)
    setLoading(false)
  }, [load])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, error, loading, reload }
}
