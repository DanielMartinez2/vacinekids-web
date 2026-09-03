import { useCallback, useEffect, useState } from 'react'

export function useApiResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    loader()
      .then((result) => { if (active) setData(result) })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError : new Error('Erro desconhecido')) })
      .finally(() => { if (active) setIsLoading(false) })

    return () => { active = false }
    // loader should be memoized by callers; dependencies intentionally control reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, attempt])

  return { data, error, isLoading, retry }
}
