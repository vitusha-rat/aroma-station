import { useCallback, useSyncExternalStore } from 'react'

const ISSUE_KEY = 'aroma-station.storage-issue'

const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()
const notify = (key: string) => listeners.get(key)?.forEach((listener) => listener())

function read<T>(key: string, parse: (raw: unknown) => T): T {
  if (!cache.has(key)) {
    let raw: unknown = null
    try {
      raw = JSON.parse(localStorage.getItem(key) ?? 'null')
    } catch {
      raw = null
    }
    cache.set(key, parse(raw))
  }
  return cache.get(key) as T
}

export function store<T>(key: string, value: T) {
  cache.set(key, value)
  let failed = false
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    failed = true
  }
  if ((cache.get(ISSUE_KEY) === true) !== failed) {
    cache.set(ISSUE_KEY, failed)
    notify(ISSUE_KEY)
  }
  notify(key)
}

function subscribe(key: string, listener: () => void) {
  const group = listeners.get(key) ?? new Set()
  listeners.set(key, group)
  group.add(listener)
  return () => group.delete(listener)
}

window.addEventListener('storage', (event) => {
  const keys = event.key ? [event.key] : [...cache.keys()]
  keys.forEach((key) => {
    cache.delete(key)
    notify(key)
  })
})

export function useStored<T>(key: string, parse: (raw: unknown) => T) {
  const value = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    () => read(key, parse),
  )
  const set = useCallback((next: T) => store(key, next), [key])
  return [value, set] as const
}

const subscribeIssue = (listener: () => void) => subscribe(ISSUE_KEY, listener)

export const useStorageIssue = () => useSyncExternalStore(subscribeIssue, () => cache.get(ISSUE_KEY) === true)
