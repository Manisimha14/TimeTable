import { pushRealtimeSync, type CourseId } from './timetable'

export type OverrideType = 'cancel' | 'reschedule' | 'extra'

export interface ScheduleOverride {
  id: string
  type: OverrideType
  // For 'cancel' and 'reschedule':
  originalKey?: string // e.g. "mon-cml-1|2" (eventId|weekIndex)
  originalCode?: string // e.g. "CML 101"
  originalDateIso?: string // e.g. "2026-08-18"
  originalTimeLabel?: string // e.g. "9:00 AM - 10:30 AM"

  // Target info for 'reschedule' and 'extra':
  courseId: Exclude<CourseId, 'clubs'>
  dateIso: string // "YYYY-MM-DD"
  startMin: number // e.g. 840 (14:00 = 2:00 PM)
  endMin: number // e.g. 930 (15:30 = 3:30 PM)
  room?: string
  note?: string
  isLab?: boolean
  title?: string
}

export const SCHEDULE_OVERRIDES_STORE_KEY = 'academic-dashboard-schedule-overrides'
export const SCHEDULE_OVERRIDES_CHANGED = 'academic-dashboard-schedule-overrides-changed'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Enforces strict schema validation for overrides before writing to store. */
function isValidOverride(o: ScheduleOverride): boolean {
  if (!o.id || !o.type || !o.courseId) return false
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

  // Type-specific validation: cancel and reschedule must specify originalKey
  if ((o.type === 'cancel' || o.type === 'reschedule') && !o.originalKey) {
    return false
  }

  return true
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

export function getScheduleOverrides(): ScheduleOverride[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(SCHEDULE_OVERRIDES_STORE_KEY)
    return saved ? (JSON.parse(saved) as ScheduleOverride[]) : []
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

export function removeScheduleOverride(id: string): void {
  const current = getScheduleOverrides()
  saveScheduleOverrides(current.filter((o) => o.id !== id))
}
