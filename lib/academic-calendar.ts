import raw from './academic-calendar.json'

export type CalEventType =
  | 'start'
  | 'mid-term'
  | 'end-term'
  | 'holiday'
  | 'break'
  | 'year-end'
  | 'events'

export interface CalEvent {
  date: string // "YYYY-MM-DD"
  type: CalEventType
  label: string
}

export const calendarEvents = raw as CalEvent[]

/* ------------------------------------------------------------------ *
 * Type metadata — one distinct, dark-mode-friendly color per type so   *
 * the calendar day cells and the legend stay perfectly in sync.        *
 * Colors are CSS custom properties defined in globals.css.             *
 * ------------------------------------------------------------------ */

export interface CalTypeMeta {
  type: CalEventType
  label: string
  /** var() token for a strong solid fill (badges, dots). */
  solid: string
  /** var() token for a soft tinted background (day cells). */
  soft: string
  /** var() token for readable text on the soft background. */
  text: string
}

export const CAL_TYPE_META: Record<CalEventType, CalTypeMeta> = {
  start: {
    type: 'start',
    label: 'Term Start',
    solid: 'var(--cal-start)',
    soft: 'var(--cal-start-soft)',
    text: 'var(--cal-start-text)',
  },
  'mid-term': {
    type: 'mid-term',
    label: 'Mid-Term',
    solid: 'var(--cal-mid)',
    soft: 'var(--cal-mid-soft)',
    text: 'var(--cal-mid-text)',
  },
  'end-term': {
    type: 'end-term',
    label: 'End-Term',
    solid: 'var(--cal-end)',
    soft: 'var(--cal-end-soft)',
    text: 'var(--cal-end-text)',
  },
  holiday: {
    type: 'holiday',
    label: 'Holiday',
    solid: 'var(--cal-holiday)',
    soft: 'var(--cal-holiday-soft)',
    text: 'var(--cal-holiday-text)',
  },
  break: {
    type: 'break',
    label: 'Break',
    solid: 'var(--cal-break)',
    soft: 'var(--cal-break-soft)',
    text: 'var(--cal-break-text)',
  },
  'year-end': {
    type: 'year-end',
    label: 'Year End',
    solid: 'var(--cal-yearend)',
    soft: 'var(--cal-yearend-soft)',
    text: 'var(--cal-yearend-text)',
  },
  events: {
    type: 'events',
    label: 'Event',
    solid: 'var(--cal-event)',
    soft: 'var(--cal-event-soft)',
    text: 'var(--cal-event-text)',
  },
}

/** Legend display order. */
export const CAL_TYPE_ORDER: CalEventType[] = [
  'start',
  'mid-term',
  'end-term',
  'holiday',
  'break',
  'year-end',
  'events',
]

/** Only the types actually present in the parsed data. */
export const presentTypes: CalEventType[] = CAL_TYPE_ORDER.filter((t) =>
  calendarEvents.some((e) => e.type === t),
)

const DAY_MS = 86_400_000

/** Parse "YYYY-MM-DD" as a UTC timestamp (avoids timezone drift). */
export function isoToMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Today at UTC midnight, matching how the term dates are stored. */
export function todayMs(date = new Date()): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Fast lookup: date-string -> events on that day. */
const byDate = new Map<string, CalEvent[]>()
for (const e of calendarEvents) {
  const arr = byDate.get(e.date)
  if (arr) arr.push(e)
  else byDate.set(e.date, [e])
}

export function eventsOn(iso: string): CalEvent[] {
  return byDate.get(iso) ?? []
}

/**
 * Set of UTC timestamps that are Holidays, Breaks, or End-Term Exam days — the timetable
 * uses this to grey out days, suppress class cards, and mark as End Term Exam Day.
 * Mid-term exam dates are explicitly excluded from blocking classes.
 */
export const blockedDayMs: Set<number> = (() => {
  const set = new Set<number>()
  for (const e of calendarEvents) {
    if (e.type === 'holiday' || e.type === 'break' || e.type === 'end-term') {
      set.add(isoToMs(e.date))
    }
  }
  return set
})()

export interface BlockedInfo {
  blocked: boolean
  type: 'holiday' | 'break' | 'end-term' | null
  label: string | null
}

/** Whether a given UTC-midnight timestamp is a holiday/break/end-term, with its label. */
export function blockedInfo(ms: number): BlockedInfo {
  if (!ms) return { blocked: false, type: null, label: null }

  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dateNum = String(d.getUTCDate()).padStart(2, '0')
  const iso = `${y}-${m}-${dateNum}`

  const ev = eventsOn(iso).find(
    (e) => e.type === 'holiday' || e.type === 'break' || e.type === 'end-term',
  )

  if (ev) {
    return {
      blocked: true,
      type: (ev.type as 'holiday' | 'break' | 'end-term') ?? 'holiday',
      label: ev.type === 'end-term' ? 'End Term Exam Day' : (ev.label ?? 'Holiday'),
    }
  }

  // Fallback check using local date formatting in case ms is local midnight
  const locY = d.getFullYear()
  const locM = String(d.getMonth() + 1).padStart(2, '0')
  const locD = String(d.getDate()).padStart(2, '0')
  const locIso = `${locY}-${locM}-${locD}`
  const locEv = eventsOn(locIso).find(
    (e) => e.type === 'holiday' || e.type === 'break' || e.type === 'end-term',
  )

  if (locEv) {
    return {
      blocked: true,
      type: (locEv.type as 'holiday' | 'break' | 'end-term') ?? 'holiday',
      label: locEv.type === 'end-term' ? 'End Term Exam Day' : (locEv.label ?? 'Holiday'),
    }
  }

  if (blockedDayMs.has(ms)) {
    return { blocked: true, type: 'holiday', label: 'Holiday' }
  }

  return { blocked: false, type: null, label: null }
}

export interface UpcomingEvent extends CalEvent {
  ms: number
  daysUntil: number
}

/**
 * Next `count` upcoming events (today or later), de-duplicated so a multi-day
 * block (e.g. a week-long break) surfaces only its first day, and consecutive
 * same-type/label runs collapse into one entry.
 */
export function upcomingEvents(count = 3, from = new Date()): UpcomingEvent[] {
  const now = todayMs(from)
  const future = calendarEvents
    .map((e) => ({ ...e, ms: isoToMs(e.date), daysUntil: 0 }))
    .filter((e) => e.ms >= now)
    .sort((a, b) => a.ms - b.ms)

  const out: UpcomingEvent[] = []
  let lastKey = ''
  let lastMs = -Infinity
  for (const e of future) {
    const key = `${e.type}|${e.label}`
    // Collapse a run of the same event on consecutive days into its start.
    if (key === lastKey && e.ms - lastMs <= DAY_MS) {
      lastMs = e.ms
      continue
    }
    out.push({ ...e, daysUntil: Math.round((e.ms - now) / DAY_MS) })
    lastKey = key
    lastMs = e.ms
    if (out.length >= count) break
  }
  return out
}

/** Human phrase for a countdown, e.g. "in 12 days" / "today" / "tomorrow". */
export function countdownPhrase(daysUntil: number): string {
  if (daysUntil <= 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  return `in ${daysUntil} days`
}

/* ---- month grid ---- */

export interface MonthKey {
  year: number
  month: number // 0-based
  label: string // "August 2026"
}

/** The list of months to page through (first..last event month, inclusive). */
export const calendarMonths: MonthKey[] = (() => {
  if (calendarEvents.length === 0) return []
  const first = isoToMs(calendarEvents[0].date)
  const last = isoToMs(calendarEvents[calendarEvents.length - 1].date)
  const months: MonthKey[] = []
  const d = new Date(first)
  let y = d.getUTCFullYear()
  let m = d.getUTCMonth()
  const end = new Date(last)
  const endY = end.getUTCFullYear()
  const endM = end.getUTCMonth()
  while (y < endY || (y === endY && m <= endM)) {
    months.push({
      year: y,
      month: m,
      label: new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
      }),
    })
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return months
})()

export interface CalDayCell {
  ms: number
  day: number
  inMonth: boolean
  iso: string
  events: CalEvent[]
  isToday: boolean
}

/**
 * Build a 6-row x 7-col (Sun..Sat) grid for a month, including leading/trailing
 * days from adjacent months (dimmed) so the grid is always rectangular.
 */
export function buildMonthGrid(year: number, month: number, today = new Date()): CalDayCell[] {
  const firstOfMonth = Date.UTC(year, month, 1)
  const startDow = new Date(firstOfMonth).getUTCDay() // 0 Sun..6 Sat
  const gridStart = firstOfMonth - startDow * DAY_MS
  const todayIso = new Date(todayMs(today)).toISOString().slice(0, 10)
  const cells: CalDayCell[] = []
  for (let i = 0; i < 42; i++) {
    const ms = gridStart + i * DAY_MS
    const d = new Date(ms)
    const iso = d.toISOString().slice(0, 10)
    cells.push({
      ms,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
      iso,
      events: eventsOn(iso),
      isToday: iso === todayIso,
    })
  }
  return cells
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Index of the month containing `date`, clamped into range. */
export function monthIndexFor(date = new Date()): number {
  const y = date.getFullYear()
  const m = date.getMonth()
  const idx = calendarMonths.findIndex((mk) => mk.year === y && mk.month === m)
  if (idx >= 0) return idx
  // Before range -> first; after range -> last.
  const nowMs = Date.UTC(y, m, 1)
  if (calendarMonths.length && nowMs < Date.UTC(calendarMonths[0].year, calendarMonths[0].month, 1))
    return 0
  return Math.max(0, calendarMonths.length - 1)
}

export function fullDate(iso: string): string {
  return new Date(isoToMs(iso)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
