import { UNITS, UNIT_KEYS, type Units } from '@stillmarch/shared'

export function countdown(ms: number): string {
  if (ms <= 0) return 'now'
  const s = Math.ceil(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

export function num(n: number): string {
  const v = Math.floor(n)
  if (Math.abs(v) >= 100_000) return `${Math.round(v / 1000)}k`
  if (Math.abs(v) >= 10_000) return `${(v / 1000).toFixed(1)}k`
  return v.toLocaleString('en-GB')
}

export function unitsText(u: Units): string {
  const parts = UNIT_KEYS.filter((k) => u[k] > 0).map((k) => `${u[k]} ${UNITS[k].plural}`)
  return parts.length ? parts.join(', ') : 'no troops'
}

/** Short numbers for tight spaces: 1,150 becomes 1.1k. */
export function compact(n: number): string {
  const v = Math.floor(n)
  if (Math.abs(v) >= 100_000) return `${Math.round(v / 1000)}k`
  if (Math.abs(v) >= 1000) return `${(Math.floor(v / 100) / 10).toFixed(1)}k`
  return String(v)
}

export function ago(ms: number): string {
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export function clock(t: number): string {
  return new Date(t).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}
