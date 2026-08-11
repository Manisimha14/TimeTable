import raw from './timetable-data.json'
import { blockedDayMs } from './academic-calendar'

export type CourseId = 'cml' | 'mern' | 'cn' | 'fdsa' | 'clubs' | 'other'

export interface SyllabusSession {
  number: string
  title: string
  topics: string[]
  assignments: string
}

export interface Evaluation {
  component: string
  weightage: string
  comments: string
}

export interface Course {
  id: CourseId
  code: string
  name: string
  color: string
  sessions: SyllabusSession[]
  evaluations: Evaluation[]
}

export interface TimetableEvent {
  id: string
  day: string
  dayIndex: number
  startMin: number
  endMin: number
  startLabel: string
  endLabel: string
  durationMin: number
  type: 'class' | 'break'
  courseId?: CourseId
  courseName?: string
  code?: string
  color?: string
  isLab?: boolean
  faculty?: string
  room?: string
  title?: string
  raw?: string
}

export interface TimetableMeta {
  term: string
  batch: string
  period: string
  days: string[]
  groups: Record<string, string>
  timeRange: { startMin: number; endMin: number }
}

export interface TimetableData {
  meta: TimetableMeta
  courses: Record<string, Course>
  eventsByGroup: Record<string, TimetableEvent[]>
}

export const timetable = raw as unknown as TimetableData

export type GroupKey = 'A' | 'B' | 'C'

/** Course display order for the legend / filters. */
export const COURSE_ORDER: CourseId[] = ['cml', 'mern', 'cn', 'fdsa', 'clubs']

export function courseClass(courseId?: string): string {
  switch (courseId) {
    case 'cml':
      return 'course-cml'
    case 'mern':
      return 'course-mern'
    case 'cn':
      return 'course-cn'
    case 'fdsa':
      return 'course-fdsa'
    case 'clubs':
      return 'course-clubs'
    default:
      return 'course-other'
  }
}

/** Convert minutes-since-midnight to a compact label e.g. "1:30 PM". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  let hh = h % 12
  if (hh === 0) hh = 12
  return m === 0 ? `${hh} ${ampm}` : `${hh}:${m.toString().padStart(2, '0')} ${ampm}`
}

/** Compact duration label e.g. "1h 30m". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Map a JS Date to a schedule day index (0 = Monday ... 5 = Saturday).
 * Returns -1 for Sunday (no classes).
 */
export function todayDayIndex(date = new Date()): number {
  const js = date.getDay() // 0 Sun ... 6 Sat
  if (js === 0) return -1
  return js - 1
}

export function courseById(id?: string): Course | undefined {
  if (!id) return undefined
  return timetable.courses[id]
}

export interface AttendanceTotals {
  sessions: number
  labs: number
  total: number
}

export interface AttendanceMetrics {
  totalClasses: number
  sessions: number
  labs: number
  requiredFor80: number
  maxAllowedMisses: number
  attended: number
  alreadyMissed: number
  unlogged: number
  canStillMiss: number
  attendancePercentage: number
  isBelow80: boolean
}

export const EXCLUDED_COURSES_STORE_KEY = 'academic-dashboard-excluded-courses'
export const EXCLUDED_COURSES_CHANGED_EVENT = 'academic-dashboard-excluded-courses-changed'

export const LOCKED_GROUP_STORE_KEY = 'academic-dashboard-user-locked-group'
export const LOCKED_GROUP_CHANGED_EVENT = 'academic-dashboard-locked-group-changed'

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCKED_GROUP_STORE_KEY) {
      window.dispatchEvent(new Event(LOCKED_GROUP_CHANGED_EVENT))
    }
    if (e.key === EXCLUDED_COURSES_STORE_KEY) {
      window.dispatchEvent(new Event(EXCLUDED_COURSES_CHANGED_EVENT))
    }
    if (e.key === ATTENDANCE_STORE_KEY) {
      window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT))
    }
  })
}

export function getLockedGroup(): GroupKey | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = window.localStorage.getItem(LOCKED_GROUP_STORE_KEY)
    return (saved as GroupKey) || null
  } catch {
    return null
  }
}

export function saveLockedGroup(group: GroupKey | null): void {
  if (typeof window === 'undefined') return
  try {
    if (group) {
      window.localStorage.setItem(LOCKED_GROUP_STORE_KEY, group)
    } else {
      window.localStorage.removeItem(LOCKED_GROUP_STORE_KEY)
    }
    window.dispatchEvent(new Event(LOCKED_GROUP_CHANGED_EVENT))
    pushRealtimeSync()
  } catch { /* Storage unavailable */ }
}

export interface DashboardBackupData {
  version: number
  exportedAt: string
  attendance: Record<string, AttendanceStatus>
  lockedGroup: GroupKey | null
  excludedCourses: Exclude<CourseId, 'clubs'>[]
  scheduleOverrides: any[]
  personalDeadlines?: any[]
  shortcuts?: any[]
  pdfs?: any[]
  gradeTarget?: { earned: number; possible: number; target: number }
}

export function exportDashboardData(): DashboardBackupData {
  const getItem = (key: string) => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    attendance: getAttendanceLog(),
    lockedGroup: getLockedGroup(),
    excludedCourses: getExcludedCourses(),
    scheduleOverrides: getScheduleOverrides(),
    personalDeadlines: getItem('academic-dashboard-personal-deadlines') ?? [],
    shortcuts: getItem('academic-dashboard-important-links') ?? [],
    pdfs: getItem('academic-dashboard-pinned-pdfs') ?? [],
    gradeTarget: getItem('academic-dashboard-grade-target') ?? { earned: 0, possible: 100, target: 80 },
  }
}

export function importDashboardData(data: DashboardBackupData): boolean {
  if (typeof window === 'undefined' || !data) return false
  try {
    if (data.attendance) {
      window.localStorage.setItem(ATTENDANCE_STORE_KEY, JSON.stringify(data.attendance))
      window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT))
    }
    if (data.lockedGroup !== undefined) {
      if (data.lockedGroup) {
        window.localStorage.setItem(LOCKED_GROUP_STORE_KEY, data.lockedGroup)
      } else {
        window.localStorage.removeItem(LOCKED_GROUP_STORE_KEY)
      }
      window.dispatchEvent(new Event(LOCKED_GROUP_CHANGED_EVENT))
    }
    if (data.excludedCourses !== undefined) {
      window.localStorage.setItem(EXCLUDED_COURSES_STORE_KEY, JSON.stringify(data.excludedCourses))
      window.dispatchEvent(new Event(EXCLUDED_COURSES_CHANGED_EVENT))
    }
    if (data.scheduleOverrides !== undefined) {
      window.localStorage.setItem('academic-dashboard-schedule-overrides', JSON.stringify(data.scheduleOverrides))
      window.dispatchEvent(new Event('academic-dashboard-schedule-overrides-changed'))
    }
    if (data.personalDeadlines !== undefined) {
      window.localStorage.setItem('academic-dashboard-personal-deadlines', JSON.stringify(data.personalDeadlines))
      window.dispatchEvent(new Event('academic-dashboard-personal-deadlines-changed'))
    }
    if (data.shortcuts !== undefined) {
      window.localStorage.setItem('academic-dashboard-important-links', JSON.stringify(data.shortcuts))
      window.dispatchEvent(new Event('academic-dashboard-tools-changed'))
    }
    if (data.pdfs !== undefined) {
      window.localStorage.setItem('academic-dashboard-pinned-pdfs', JSON.stringify(data.pdfs))
      window.dispatchEvent(new Event('academic-dashboard-tools-changed'))
    }
    if (data.gradeTarget !== undefined) {
      window.localStorage.setItem('academic-dashboard-grade-target', JSON.stringify(data.gradeTarget))
      window.dispatchEvent(new Event('academic-dashboard-tools-changed'))
    }
    return true
  } catch {
    return false
  }
}

export function generateSyncUrl(): string {
  if (typeof window === 'undefined') return ''
  const data = exportDashboardData()
  const jsonStr = JSON.stringify(data)
  const encoded = btoa(encodeURIComponent(jsonStr))
  const url = new URL(window.location.href)
  url.searchParams.set('sync', encoded)
  return url.toString()
}

export function loadSyncFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    const syncParam = url.searchParams.get('sync')
    if (!syncParam) return false
    const jsonStr = decodeURIComponent(atob(syncParam))
    const data = JSON.parse(jsonStr) as DashboardBackupData
    const success = importDashboardData(data)
    if (success) {
      url.searchParams.delete('sync')
      window.history.replaceState({}, '', url.toString())
    }
    return success
  } catch {
    return false
  }
}

export const REALTIME_SYNC_CODE_STORE_KEY = 'academic-dashboard-sync-code'
export const REALTIME_SYNC_TIMESTAMP_KEY = 'academic-dashboard-sync-last-timestamp'
export const REALTIME_SYNC_CHANGED_EVENT = 'academic-dashboard-sync-changed'

export function getSyncCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(REALTIME_SYNC_CODE_STORE_KEY)
  } catch {
    return null
  }
}

export function saveSyncCode(code: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (code) {
      window.localStorage.setItem(REALTIME_SYNC_CODE_STORE_KEY, code.trim().toUpperCase())
    } else {
      window.localStorage.removeItem(REALTIME_SYNC_CODE_STORE_KEY)
      window.localStorage.removeItem(REALTIME_SYNC_TIMESTAMP_KEY)
    }
    window.dispatchEvent(new Event(REALTIME_SYNC_CHANGED_EVENT))
    if (code) pushRealtimeSync()
  } catch { /* Storage unavailable */ }
}

let isSyncing = false

export async function pushRealtimeSync(): Promise<boolean> {
  const code = getSyncCode()
  if (!code || isSyncing || typeof window === 'undefined') return false
  try {
    isSyncing = true
    const data = exportDashboardData()
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, data }),
    })
    const json = await res.json()
    if (json.timestamp) {
      window.localStorage.setItem(REALTIME_SYNC_TIMESTAMP_KEY, String(json.timestamp))
    }
    return json.success
  } catch {
    return false
  } finally {
    isSyncing = false
  }
}

export async function pullRealtimeSync(): Promise<boolean> {
  const code = getSyncCode()
  if (!code || isSyncing || typeof window === 'undefined') return false
  try {
    const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`)
    const json = await res.json()
    if (json.found && json.data) {
      const lastLocalTs = Number(window.localStorage.getItem(REALTIME_SYNC_TIMESTAMP_KEY) || 0)
      if (json.timestamp > lastLocalTs) {
        isSyncing = true
        importDashboardData(json.data)
        window.localStorage.setItem(REALTIME_SYNC_TIMESTAMP_KEY, String(json.timestamp))
        isSyncing = false
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export function isFdsaVisible(): boolean {
  return !getExcludedCourses().includes('fdsa')
}

export function setFdsaVisible(visible: boolean): void {
  const excluded = getExcludedCourses()
  const next = visible
    ? excluded.filter((id) => id !== 'fdsa')
    : Array.from(new Set([...excluded, 'fdsa' as const]))
  saveExcludedCourses(next)
}

export function getExcludedCourses(): Exclude<CourseId, 'clubs'>[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(EXCLUDED_COURSES_STORE_KEY)
    return saved ? (JSON.parse(saved) as Exclude<CourseId, 'clubs'>[]) : []
  } catch {
    return []
  }
}

export function saveExcludedCourses(excluded: Exclude<CourseId, 'clubs'>[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EXCLUDED_COURSES_STORE_KEY, JSON.stringify(excluded))
    window.dispatchEvent(new Event(EXCLUDED_COURSES_CHANGED_EVENT))
    pushRealtimeSync()
  } catch { /* Storage unavailable */ }
}

export interface LabBreakdown {
  totalLabs: number
  mernLabs: number
  fdsaLabs: number
  cmlLabs: number
  cnLabs: number
}

export function getLabBreakdown(
  group: GroupKey,
  overrides: ScheduleOverride[] = getScheduleOverrides(),
  excluded: Exclude<CourseId, 'clubs'>[] = getExcludedCourses(),
): LabBreakdown {
  const courseIds: Exclude<CourseId, 'clubs'>[] = (['cml', 'mern', 'cn', 'fdsa'] as const).filter(
    (id) => !excluded.includes(id),
  )
  let mernLabs = 0
  let fdsaLabs = 0
  let cmlLabs = 0
  let cnLabs = 0

  for (const cid of courseIds) {
    const occs = courseOccurrences(group, cid, overrides)
    const count = occs.filter((o) => o.isLab).length
    if (cid === 'mern') mernLabs = count
    else if (cid === 'fdsa') fdsaLabs = count
    else if (cid === 'cml') cmlLabs = count
    else if (cid === 'cn') cnLabs = count
  }

  return {
    totalLabs: mernLabs + fdsaLabs + cmlLabs + cnLabs,
    mernLabs,
    fdsaLabs,
    cmlLabs,
    cnLabs,
  }
}

export function getAttendanceMetrics(
  group: GroupKey,
  courseId: CourseId | 'all',
  log: Record<string, AttendanceStatus> = getAttendanceLog(),
  overrides: ScheduleOverride[] = getScheduleOverrides(),
  now: Date = new Date(),
  excluded: Exclude<CourseId, 'clubs'>[] = getExcludedCourses(),
): AttendanceMetrics {
  const courseIds: Exclude<CourseId, 'clubs'>[] =
    courseId === 'all'
      ? (['cml', 'mern', 'cn', 'fdsa'] as Exclude<CourseId, 'clubs'>[]).filter(
          (id) => !excluded.includes(id),
        )
      : courseId === 'clubs' || excluded.includes(courseId)
        ? []
        : [courseId]

  let allOccurrences: ExtendedOccurrence[] = []
  for (const cid of courseIds) {
    const occs = courseOccurrences(group, cid, overrides)
    for (const occ of occs) {
      allOccurrences.push({
        ...occ,
        courseId: cid,
        courseName: timetable.courses[cid]?.name ?? cid.toUpperCase(),
      })
    }
  }

  allOccurrences = allOccurrences.sort((a, b) => a.ms - b.ms || a.startMin - b.startMin)

  const sessions = allOccurrences.filter((occ) => !occ.isLab).length
  const labs = allOccurrences.filter((occ) => occ.isLab).length
  const totalClasses = allOccurrences.length

  const requiredFor80 = Math.ceil(totalClasses * 0.8)
  const maxAllowedMisses = Math.max(0, totalClasses - requiredFor80)

  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const completed = allOccurrences.filter(
    (occ) =>
      occ.ms < todayMs || (occ.ms === todayMs && occ.endMin <= nowMinutes),
  )

  const attended = completed.filter((occ) => log[occ.key] === 'present').length
  const alreadyMissed = completed.filter((occ) => log[occ.key] === 'missed').length
  const unlogged = completed.filter((occ) => !log[occ.key]).length

  const canStillMiss = Math.max(0, maxAllowedMisses - alreadyMissed)

  const totalLogged = attended + alreadyMissed
  const attendancePercentage = totalLogged ? Math.round((attended / totalLogged) * 100) : 100
  const isBelow80 = alreadyMissed > maxAllowedMisses

  return {
    totalClasses,
    sessions,
    labs,
    requiredFor80,
    maxAllowedMisses,
    attended,
    alreadyMissed,
    unlogged,
    canStillMiss,
    attendancePercentage,
    isBelow80,
  }
}

/**
 * Attendance totals reflecting real teachable occurrences & schedule overrides.
 */
export function attendanceTotals(
  group: GroupKey,
  courseId?: CourseId,
  overrides: ScheduleOverride[] = getScheduleOverrides(),
): AttendanceTotals {
  const metrics = getAttendanceMetrics(group, courseId ?? 'all', getAttendanceLog(), overrides)
  return {
    sessions: metrics.sessions,
    labs: metrics.labs,
    total: metrics.totalClasses,
  }
}

export interface CourseProgress {
  total: number
  held: number
  remaining: number
  completionMs: number | null
}

export type AttendanceStatus = 'present' | 'missed'
export const ATTENDANCE_STORE_KEY = 'academic-dashboard-attendance-by-session'
export const ATTENDANCE_CHANGED_EVENT = 'academic-dashboard-attendance-changed'

export function getAttendanceLog(): Record<string, AttendanceStatus> {
  if (typeof window === 'undefined') return {}
  try {
    const saved = window.localStorage.getItem(ATTENDANCE_STORE_KEY)
    return saved ? (JSON.parse(saved) as Record<string, AttendanceStatus>) : {}
  } catch {
    return {}
  }
}

export function saveAttendanceLog(log: Record<string, AttendanceStatus>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ATTENDANCE_STORE_KEY, JSON.stringify(log))
    window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT))
    pushRealtimeSync()
  } catch { /* Storage unavailable */ }
}

export function setAttendanceStatus(key: string, status: AttendanceStatus | null): void {
  const current = getAttendanceLog()
  const next = { ...current }
  if (status === null) {
    delete next[key]
  } else {
    next[key] = status
  }
  saveAttendanceLog(next)
}

import { isoToMs } from './academic-calendar'
import { getScheduleOverrides, type ScheduleOverride } from './schedule-overrides'

export interface CourseOccurrence {
  key: string
  ms: number
  startMin: number
  endMin: number
  code: string
  isLab: boolean
}

export interface ExtendedOccurrence extends CourseOccurrence {
  courseId: Exclude<CourseId, 'clubs'>
  courseName: string
  overrideType?: 'cancel' | 'reschedule' | 'extra'
  overrideNote?: string
  originalKey?: string
}

/** Individual teachable occurrences for an assessed course, taking schedule overrides into account. */
export function courseOccurrences(
  group: GroupKey,
  courseId: Exclude<CourseId, 'clubs'>,
  overrides: ScheduleOverride[] = getScheduleOverrides(),
): CourseOccurrence[] {
  const theory: CourseOccurrence[] = []
  const labs: CourseOccurrence[] = []

  const cancelKeys = new Set(
    overrides.filter((o) => o.type === 'cancel' || o.type === 'reschedule').map((o) => o.originalKey),
  )

  for (const week of WEEKS) {
    for (const event of timetable.eventsByGroup[group] ?? []) {
      if (event.type !== 'class' || event.courseId !== courseId) continue
      const cell = week.days[event.dayIndex]
      if (!cell?.inTerm || blockedDayMs.has(cell.ms)) continue
      const key = `${event.id}|${week.index}`
      if (cancelKeys.has(key)) continue

      const occurrence = {
        key,
        ms: cell.ms,
        startMin: event.startMin,
        endMin: event.endMin,
        code: event.code ?? '',
        isLab: Boolean(event.isLab),
      }
      if (event.isLab) {
        labs.push(occurrence)
      } else theory.push(occurrence)
    }
  }

  // Add rescheduled and extra classes for this course
  for (const ov of overrides.filter((o) => o.courseId === courseId)) {
    if (ov.type === 'reschedule' || ov.type === 'extra') {
      const ms = isoToMs(ov.dateIso)
      if (blockedDayMs.has(ms)) continue
      const occ: CourseOccurrence = {
        key: ov.id,
        ms,
        startMin: ov.startMin,
        endMin: ov.endMin,
        code: timetable.courses[courseId]?.code ?? courseId.toUpperCase(),
        isLab: Boolean(ov.isLab),
      }
      if (ov.isLab) {
        labs.push(occ)
      } else theory.push(occ)
    }
  }

  const sessionCount = timetable.courses[courseId]?.sessions.length ?? 0
  return [
    ...theory.sort((a, b) => a.ms - b.ms || a.startMin - b.startMin).slice(0, sessionCount),
    ...labs,
  ].sort((a, b) => a.ms - b.ms || a.startMin - b.startMin)
}

/** Occurrences across all assessed courses, in calendar order. */
export function allCourseOccurrences(
  group: GroupKey,
  overrides: ScheduleOverride[] = getScheduleOverrides(),
  excluded: Exclude<CourseId, 'clubs'>[] = getExcludedCourses(),
): ExtendedOccurrence[] {
  const courseIds: Exclude<CourseId, 'clubs'>[] = (['cml', 'mern', 'cn', 'fdsa'] as const).filter(
    (id) => !excluded.includes(id),
  )
  const result: ExtendedOccurrence[] = []
  for (const cid of courseIds) {
    const occs = courseOccurrences(group, cid, overrides)
    for (const occ of occs) {
      result.push({
        ...occ,
        courseId: cid,
        courseName: timetable.courses[cid]?.name ?? cid.toUpperCase(),
      })
    }
  }
  return result.sort((a, b) => a.ms - b.ms || a.startMin - b.startMin)
}

/** Course plan projected over real calendar dates, excluding published no-class days. */
export function courseProgress(group: GroupKey, courseId: Exclude<CourseId, 'clubs'>, date = new Date()): CourseProgress {
  const planned = courseOccurrences(group, courseId)
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const held = planned.filter((occurrence) => occurrence.ms < now).length
  return {
    total: planned.length,
    held,
    remaining: Math.max(0, planned.length - held),
    completionMs: planned.length ? planned[planned.length - 1].ms : null,
  }
}

/* ------------------------------------------------------------------ *
 * Term calendar — the weekly template repeats across the term, but    *
 * each week maps onto real dates, and each class occurrence maps to    *
 * the next syllabus session in chronological order.                    *
 * ------------------------------------------------------------------ */

const DAY_MS = 86_400_000
// Term window (UTC to avoid timezone drift). Mon Aug 10 – Sat Oct 24, 2026
// (Oct 24 is the final end-term exam date, eliminating Week 12).
const TERM_START = Date.UTC(2026, 7, 10)
const TERM_END = Date.UTC(2026, 9, 24)

export interface DayCell {
  ms: number
  inTerm: boolean
  dateShort: string // "Aug 26"
  dayNum: number
}

export interface Week {
  index: number
  days: DayCell[] // Monday..Saturday (length 6)
  label: string // in-term span, e.g. "Aug 26 – Aug 29"
}

function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
}

function mondayOnOrBefore(ms: number): number {
  const dow = new Date(ms).getUTCDay() // 0 Sun .. 6 Sat
  const offset = dow === 0 ? 6 : dow - 1
  return ms - offset * DAY_MS
}

/** All term weeks (Monday-anchored), each with its six weekday dates. */
export const WEEKS: Week[] = (() => {
  const weeks: Week[] = []
  let monday = mondayOnOrBefore(TERM_START)
  let idx = 1
  while (monday <= TERM_END) {
    const days: DayCell[] = []
    for (let i = 0; i < 6; i++) {
      const ms = monday + i * DAY_MS
      days.push({
        ms,
        inTerm: ms >= TERM_START && ms <= TERM_END,
        dateShort: fmtDate(ms, { month: 'short', day: 'numeric' }),
        dayNum: new Date(ms).getUTCDate(),
      })
    }
    const term = days.filter((d) => d.inTerm)
    const first = term[0] ?? days[0]
    const last = term[term.length - 1] ?? days[5]
    weeks.push({ index: idx, days, label: `${first.dateShort} – ${last.dateShort}` })
    monday += 7 * DAY_MS
    idx++
  }
  return weeks
})()

export function weekByIndex(index: number): Week | undefined {
  return WEEKS.find((w) => w.index === index)
}

/** Week index (1-based) containing `date`, clamped to the term. */
export function currentWeekIndex(date = new Date()): number {
  const ms = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  if (ms < WEEKS[0].days[0].ms) return WEEKS[0].index
  // Each week runs Monday (days[0]) through the following Sunday, so a weekend
  // date still resolves to the week it belongs to rather than falling through.
  for (const w of WEEKS) {
    if (ms >= w.days[0].ms && ms < w.days[0].ms + 7 * DAY_MS) return w.index
  }
  return WEEKS[WEEKS.length - 1].index
}

export function dayCellFor(event: TimetableEvent, weekIndex: number): DayCell | null {
  const w = weekByIndex(weekIndex)
  return w ? (w.days[event.dayIndex] ?? null) : null
}

export function fullDateLabel(ms: number): string {
  return fmtDate(ms, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

/* ---- session-per-date mapping ---- */

interface OccInfo {
  index: number // 0-based chronological order within the course
  total: number // number of syllabus sessions for the course
}

const occCache: Partial<Record<GroupKey, Map<string, OccInfo>>> = {}

const occKey = (eventId: string, weekIndex: number) => `${eventId}|${weekIndex}`

function buildOccurrences(group: GroupKey): Map<string, OccInfo> {
  const map = new Map<string, OccInfo>()
  const events = timetable.eventsByGroup[group] ?? []
  const byCourse: Record<string, TimetableEvent[]> = {}
  for (const e of events) {
    // Labs are hands-on slots and are NOT mapped to a syllabus session, so
    // they are excluded here and never consume a theory session number.
    if (e.type !== 'class' || !e.courseId || e.isLab) continue
    ;(byCourse[e.courseId] ||= []).push(e)
  }
  for (const [courseId, evs] of Object.entries(byCourse)) {
    const total = timetable.courses[courseId]?.sessions.length ?? 0
    const occ: { key: string; sortKey: number }[] = []
    for (const w of WEEKS) {
      for (const e of evs) {
        const cell = w.days[e.dayIndex]
        // A class does not take place during a published holiday or break.
        // Skipping it here keeps the syllabus-session mapping in lockstep with
        // the timetable UI, rather than silently consuming a session that was
        // never taught.
        if (!cell || !cell.inTerm || blockedDayMs.has(cell.ms)) continue
        occ.push({ key: occKey(e.id, w.index), sortKey: cell.ms + e.startMin })
      }
    }
    occ.sort((a, b) => a.sortKey - b.sortKey)
    occ.forEach((o, i) => map.set(o.key, { index: i, total }))
  }
  return map
}

export interface SessionForResult {
  index: number
  total: number
  sessionNumber: number
  session: SyllabusSession | null
  beyondSyllabus: boolean
}

/** The specific syllabus session taught at this event's occurrence in `weekIndex`. */
export function sessionFor(
  group: GroupKey,
  event: TimetableEvent,
  weekIndex: number,
): SessionForResult | null {
  if (event.type !== 'class') return null
  occCache[group] ||= buildOccurrences(group)
  const info = occCache[group]!.get(occKey(event.id, weekIndex))
  if (!info) return null
  const course = event.courseId ? timetable.courses[event.courseId] : undefined
  const session =
    course && info.index < course.sessions.length ? course.sessions[info.index] : null
  return {
    index: info.index,
    total: info.total,
    sessionNumber: info.index + 1,
    session,
    beyondSyllabus: info.total > 0 && info.index >= info.total,
  }
}

/* ---- room parsing ---- */

export interface RoomInfo {
  section: string | null // A / B / C
  floorShort: string // GF / 1F / 2F
  floorLabel: string // "1st floor"
  name: string // "Room A" or "Classroom"
}

export function parseRoom(room?: string): RoomInfo | null {
  if (!room) return null
  const s = room.toLowerCase()
  let floorShort = ''
  let floorLabel = ''
  if (/ground/.test(s)) {
    floorShort = 'GF'
    floorLabel = 'Ground floor'
  } else if (/\b(2nd|second)\b/.test(s)) {
    floorShort = '2F'
    floorLabel = '2nd floor'
  } else if (/\b(3rd|third)\b/.test(s)) {
    floorShort = '3F'
    floorLabel = '3rd floor'
  } else if (/\b(1st|ist|first)\b/.test(s)) {
    floorShort = '1F'
    floorLabel = '1st floor'
  }
  const secMatch = s.match(/class(?:room)?\s+([abc])\b/)
  const section = secMatch ? secMatch[1].toUpperCase() : null
  return {
    section,
    floorShort,
    floorLabel,
    name: section ? `Room ${section}` : 'Classroom',
  }
}

/* ---- evaluation schemes ---- */

export interface EvalScheme {
  heading: string
  items: Evaluation[]
}

/** Split evaluation rows into named schemes (Standard vs. Repeat/Exempted). */
export function evaluationSchemes(course: Course): EvalScheme[] {
  const schemes: EvalScheme[] = [{ heading: 'Standard evaluation', items: [] }]
  let current = schemes[0]
  for (const e of course.evaluations) {
    const isDivider =
      /internship exempted|course repeat|repeat student/i.test(e.component) && !e.weightage
    if (isDivider) {
      current = { heading: e.component.replace(/:/g, '').trim(), items: [] }
      schemes.push(current)
      continue
    }
    // skip stray rows with neither weightage nor a real component
    if (!e.component) continue
    current.items.push(e)
  }
  return schemes.filter((s) => s.items.length > 0)
}

/* ---- faculty + search ---- */

export function facultiesFor(courseId: string): string[] {
  const set = new Set<string>()
  for (const g of Object.keys(timetable.eventsByGroup)) {
    for (const e of timetable.eventsByGroup[g]) {
      if (e.courseId === courseId && e.faculty) set.add(e.faculty)
    }
  }
  return [...set]
}

/** Whether an event passes the active course filter + free-text query. */
export function eventMatches(
  event: TimetableEvent,
  query: string,
  courseId: string | null,
): boolean {
  if (courseId && event.courseId !== courseId) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [event.code, event.courseName, event.faculty, event.room].some((v) =>
    (v ?? '').toLowerCase().includes(q),
  )
}

/** Generate and trigger download of an .ics iCalendar file for the selected Group timetable */
export function exportCalendarIcal(group: GroupKey): void {
  if (typeof window === 'undefined') return
  const events = eventsForGroup(group)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scaler SST//Term 5 Timetable//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:SST 2029 Group ${group} Timetable`,
  ]

  const daysMap: Record<number, string> = { 0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA' }
  const refStartDate = new Date(Date.UTC(2026, 7, 10))

  events.filter((e) => e.type === 'class').forEach((e, idx) => {
    const dayOffset = e.dayIndex
    const startHour = Math.floor(e.startMin / 60)
    const startMin = e.startMin % 60
    const endHour = Math.floor(e.endMin / 60)
    const endMin = e.endMin % 60

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

    const eventDate = new Date(refStartDate.getTime() + dayOffset * 86400000)
    const yyyy = eventDate.getUTCFullYear()
    const mm = pad(eventDate.getUTCMonth() + 1)
    const dd = pad(eventDate.getUTCDate())

    const dtStart = `${yyyy}${mm}${dd}T${pad(startHour)}${pad(startMin)}00`
    const dtEnd = `${yyyy}${mm}${dd}T${pad(endHour)}${pad(endMin)}00`

    ics.push(
      'BEGIN:VEVENT',
      `UID:sst-2029-g${group}-${e.courseId}-${e.dayIndex}-${idx}@scalersst.edu`,
      `DTSTAMP:${yyyy}${mm}${dd}T000000Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `RRULE:FREQ=WEEKLY;UNTIL=20261031T235959Z;BYDAY=${daysMap[e.dayIndex] || 'MO'}`,
      `SUMMARY:${e.code} - ${e.courseName}${e.isLab ? ' (Lab)' : ''}`,
      `LOCATION:${e.room || 'SST Campus'}`,
      `DESCRIPTION:Faculty: ${e.faculty || 'SST Instructor'} | Group: ${group}`,
      'END:VEVENT',
    )
  })

  ics.push('END:VCALENDAR')
  const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `SST_2029_Term_5_Group_${group}_Timetable.ics`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
