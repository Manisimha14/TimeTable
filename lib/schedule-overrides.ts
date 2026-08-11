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

export function getScheduleOverrides(): ScheduleOverride[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(SCHEDULE_OVERRIDES_STORE_KEY)
    return saved ? (JSON.parse(saved) as ScheduleOverride[]) : []
  } catch {
    return []
  }
}

export function saveScheduleOverrides(overrides: ScheduleOverride[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SCHEDULE_OVERRIDES_STORE_KEY, JSON.stringify(overrides))
    window.dispatchEvent(new Event(SCHEDULE_OVERRIDES_CHANGED))
    pushRealtimeSync()
  } catch {
    /* LocalStorage unavailable */
  }
}

export function addScheduleOverride(override: ScheduleOverride): void {
  const current = getScheduleOverrides()
  const next = override.originalKey
    ? [...current.filter((o) => o.originalKey !== override.originalKey), override]
    : [...current, override]
  saveScheduleOverrides(next)
}

export function removeScheduleOverride(id: string): void {
  const current = getScheduleOverrides()
  saveScheduleOverrides(current.filter((o) => o.id !== id))
}
