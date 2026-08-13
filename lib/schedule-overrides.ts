import { pushRealtimeSync, type CourseId } from './timetable'

export type OverrideType = 'cancel' | 'reschedule' | 'extra'

export interface BaseOverride {
  id: string
  courseId: Exclude<CourseId, 'clubs'>
  dateIso: string // "YYYY-MM-DD"
  startMin: number // e.g. 840 (14:00 = 2:00 PM)
  endMin: number // e.g. 930 (15:30 = 3:30 PM)
  room?: string
  note?: string
  isLab?: boolean
  title?: string
  version?: number
}

export interface CancelOverride extends BaseOverride {
  type: 'cancel'
  originalKey: string // "eventId|weekIndex" e.g. "mon-cml-1|2"
  originalCode?: string
  originalDateIso?: string
  originalTimeLabel?: string
}

export interface RescheduleOverride extends BaseOverride {
  type: 'reschedule'
  originalKey: string // "eventId|weekIndex"
  originalCode?: string
  originalDateIso?: string
  originalTimeLabel?: string
}

export interface ExtraOverride extends BaseOverride {
  type: 'extra'
  originalKey?: never
  originalCode?: string
  originalDateIso?: string
  originalTimeLabel?: string
}

export type ScheduleOverride = CancelOverride | RescheduleOverride | ExtraOverride

export const SCHEDULE_OVERRIDES_STORE_KEY = 'academic-dashboard-schedule-overrides'
export const SCHEDULE_OVERRIDES_CHANGED = 'academic-dashboard-schedule-overrides-changed'

const SCHEMA_VERSION = 2
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// In-memory undo stack for recently deleted overrides
const undoStack: ScheduleOverride[] = []

/** Enforces discriminated union & value validation for overrides before saving. */
export function isValidOverride(o: ScheduleOverride): boolean {
  if (!o || !o.id || !o.type || !o.courseId) return false
  if (!ISO_DATE_RE.test(o.dateIso)) return false
  if (
    typeof o.startMin !== 'number' ||
    typeof o.endMin !== 'number' ||
    !Number.isFinite(o.startMin) ||
    !Number.isFinite(o.endMin) ||
    o.startMin < 0 ||
    o.endMin < 0 ||
    o.endMin <= o.startMin
  ) {
    return false
  }

  // Type-narrowing validation: cancel and reschedule MUST supply an originalKey
  if ((o.type === 'cancel' || o.type === 'reschedule') && !o.originalKey) {
    return false
  }

  return true
}

/** Check if an override conflicts (time overlap) with existing active overrides. */
export function getConflicts(override: ScheduleOverride): ScheduleOverride[] {
  if (override.type === 'cancel') return []
  const current = getScheduleOverrides()
  return current.filter((existing) => {
    if (existing.id === override.id || existing.type === 'cancel') return false
    if (existing.dateIso !== override.dateIso) return false
    // Time overlap check: startA < endB && endA > startB
    return override.startMin < existing.endMin && override.endMin > existing.startMin
  })
}

/** Debounces pushRealtimeSync calls so rapid saves collapse into a single sync call. */
let syncTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSync(delayMs = 300): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    pushRealtimeSync()
  }, delayMs)
}

// Automatically retry pending sync on network recovery
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    pushRealtimeSync()
  })
}

function migrateOverride(raw: any): ScheduleOverride {
  return {
    version: SCHEMA_VERSION,
    ...raw,
  }
}

export function getScheduleOverrides(): ScheduleOverride[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(SCHEDULE_OVERRIDES_STORE_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved) as any[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(migrateOverride).filter(isValidOverride)
  } catch (err) {
    console.warn('[schedule-overrides] failed to read/parse overrides from localStorage:', err)
    return []
  }
}

export function saveScheduleOverrides(overrides: ScheduleOverride[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SCHEDULE_OVERRIDES_STORE_KEY, JSON.stringify(overrides))
    window.dispatchEvent(new Event(SCHEDULE_OVERRIDES_CHANGED))
    scheduleSync()
  } catch (err) {
    console.warn('[schedule-overrides] failed to save overrides to localStorage:', err)
  }
}

/** Selector helpers to eliminate duplicated component filtering code. */
export function getOverridesForDate(dateIso: string): ScheduleOverride[] {
  return getScheduleOverrides().filter(
    (o) => o.dateIso === dateIso || o.originalDateIso === dateIso,
  )
}

export function getOverridesForCourse(
  courseId: Exclude<CourseId, 'clubs'>,
): ScheduleOverride[] {
  return getScheduleOverrides().filter((o) => o.courseId === courseId)
}

export function getActiveOverrideForKey(originalKey: string): ScheduleOverride | undefined {
  return getScheduleOverrides().find((o) => o.originalKey === originalKey)
}

/**
 * Builds a stable identity key for an override so we can dedupe 'extra' entries
 * (which have no originalKey) the same way we dedupe cancel/reschedule entries.
 */
function overrideIdentityKey(o: ScheduleOverride): string {
  if (o.originalKey) return `orig:${o.originalKey}`
  return `slot:${o.courseId}|${o.dateIso}|${o.startMin}|${o.endMin}`
}

export function addScheduleOverride(override: ScheduleOverride): void {
  if (!isValidOverride(override)) {
    console.warn('[schedule-overrides] rejected invalid override:', override)
    return
  }
  const current = getScheduleOverrides()
  const key = overrideIdentityKey(override)
  const next = [...current.filter((o) => overrideIdentityKey(o) !== key), override]
  saveScheduleOverrides(next)
}

export function addScheduleOverrides(newOverrides: ScheduleOverride[]): void {
  const valid = newOverrides.filter((o) => isValidOverride(o))
  if (!valid.length) return
  const current = getScheduleOverrides()
  const keysToRemove = new Set(valid.map(overrideIdentityKey))
  const next = [
    ...current.filter((o) => !keysToRemove.has(overrideIdentityKey(o))),
    ...valid,
  ]
  saveScheduleOverrides(next)
}

export function removeScheduleOverride(id: string): void {
  const current = getScheduleOverrides()
  const target = current.find((o) => o.id === id)
  if (target) undoStack.push(target)
  saveScheduleOverrides(current.filter((o) => o.id !== id))
}

export function removeScheduleOverrides(ids: string[]): void {
  const set = new Set(ids)
  const current = getScheduleOverrides()
  const toRemove = current.filter((o) => set.has(o.id))
  undoStack.push(...toRemove)
  saveScheduleOverrides(current.filter((o) => !set.has(o.id)))
}

export function restoreLastDeletedOverride(): ScheduleOverride | null {
  const last = undoStack.pop()
  if (!last) return null
  addScheduleOverride(last)
  return last
}

/** Prunes overrides for dates before beforeDateIso to keep localStorage lightweight. */
export function pruneExpiredOverrides(beforeDateIso: string): number {
  const current = getScheduleOverrides()
  const next = current.filter((o) => o.dateIso >= beforeDateIso)
  const prunedCount = current.length - next.length
  if (prunedCount > 0) {
    saveScheduleOverrides(next)
  }
  return prunedCount
}
