// Minimal, dependency-free replacements for the handful of lodash functions
// the extension relied on. Behaviour matches lodash for our call sites: string
// ('a.b.c' / 'a[0].b') and array (['a', 'b']) property paths, leading+trailing
// throttling, and a stable, multi-key ascending sort. Replacing lodash lets us
// drop it as a dependency (its remaining audit advisories have no released fix).

type PropertyPath = string | ReadonlyArray<string | number>
type Iteratee<T> = string | ((item: T) => any)

function toPath(path: PropertyPath): (string | number)[] {
  if (Array.isArray(path))
    return [...path] as (string | number)[]
  // split on dots and [bracket] segments, matching lodash's string paths
  return String(path).match(/[^.[\]]+/g) ?? []
}

export function get(object: any, path: PropertyPath, defaultValue?: any): any {
  let result = object
  for (const key of toPath(path)) {
    if (result == null)
      return defaultValue
    result = result[key]
  }
  return result === undefined ? defaultValue : result
}

export function set<T>(object: T, path: PropertyPath, value: any): T {
  const keys = toPath(path)
  if (!keys.length)
    return object

  let current: any = object
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    // guard against prototype pollution, as lodash does for __proto__
    if (key === '__proto__')
      return object
    if (current[key] == null || typeof current[key] !== 'object')
      current[key] = {}
    current = current[key]
  }

  const last = keys[keys.length - 1]
  if (last !== '__proto__')
    current[last] = value
  return object
}

export function uniq<T>(array: readonly T[]): T[] {
  return [...new Set(array)]
}

export function isObject(value: any): boolean {
  const type = typeof value
  return value != null && (type === 'object' || type === 'function')
}

export function sortBy<T>(collection: readonly T[], ...iteratees: Iteratee<T>[]): T[] {
  const fns = iteratees.map(it =>
    typeof it === 'function' ? it : (item: T) => get(item, it))
  // Array.prototype.sort is stable, matching lodash's stable sortBy
  return [...collection].sort((a, b) => {
    for (const fn of fns) {
      const av = fn(a)
      const bv = fn(b)
      if (av < bv)
        return -1
      if (av > bv)
        return 1
    }
    return 0
  })
}

function trimChars(str: string, chars: string, side: 'both' | 'end'): string {
  const cls = `[${chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
  const re = side === 'both'
    ? new RegExp(`^${cls}+|${cls}+$`, 'g')
    : new RegExp(`${cls}+$`)
  return str.replace(re, '')
}

export function trim(str: string, chars: string): string {
  return trimChars(str, chars, 'both')
}

export function trimEnd(str: string, chars: string): string {
  return trimChars(str, chars, 'end')
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait = 0,
  options: { leading?: boolean; trailing?: boolean } = {},
): T {
  const { leading = true, trailing = true } = options
  let lastInvoke = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: any[] | undefined
  let lastThis: any

  function invoke() {
    lastInvoke = Date.now()
    timer = undefined
    func.apply(lastThis, lastArgs!)
    lastArgs = lastThis = undefined
  }

  return function (this: any, ...args: any[]) {
    const now = Date.now()
    if (lastInvoke === 0 && !leading)
      lastInvoke = now

    const remaining = wait - (now - lastInvoke)
    lastArgs = args
    lastThis = this

    // fire on the leading edge (or if the clock jumped backwards)
    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      invoke()
    }
    // otherwise schedule the trailing edge
    else if (trailing && !timer) {
      timer = setTimeout(invoke, remaining)
    }
  } as T
}
