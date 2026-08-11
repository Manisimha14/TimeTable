'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Flag, Palmtree, School } from 'lucide-react'
import {
  CAL_TYPE_META,
  countdownPhrase,
  upcomingEvents,
  type UpcomingEvent,
} from '@/lib/academic-calendar'
import { staggerContainer, riseItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { defaultPersonalDeadlines, deadlineDateLabel, PERSONAL_DEADLINES_CHANGED, PERSONAL_DEADLINES_STORE_KEY, type PersonalDeadline } from '@/lib/personal-deadlines'
import { HolidayIcon } from '@/components/holiday-icon'

interface KeyDatesProps {
  className?: string
  /** Jump to the calendar view (optionally on a given month) when clicked. */
  onOpenCalendar?: () => void
}

/**
 * Compact "Key dates" widget for the dashboard home: the next few upcoming
 * academic-calendar events with a live countdown ("in 12 days"). Computed on
 * the client so the countdown reflects the user's real current date.
 */
export function KeyDates({ className, onOpenCalendar }: KeyDatesProps) {
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null)
  const [personalDeadline, setPersonalDeadline] = useState<PersonalDeadline | null>(null)

  useEffect(() => {
    const upcoming = upcomingEvents(100)
    const holiday = upcoming.find((event) => event.type === 'holiday')
    const assessment = upcoming.find((event) => event.type === 'mid-term' || event.type === 'end-term')
    setEvents([holiday, assessment].filter((event): event is UpcomingEvent => Boolean(event)))
  }, [])

  useEffect(() => {
    const updateDeadline = () => {
      try {
        const saved = window.localStorage.getItem(PERSONAL_DEADLINES_STORE_KEY)
        const deadlines = saved ? (JSON.parse(saved) as PersonalDeadline[]) : defaultPersonalDeadlines
        const today = new Date().toISOString().slice(0, 10)
        setPersonalDeadline([...deadlines].filter((deadline) => deadline.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null)
      } catch { setPersonalDeadline(defaultPersonalDeadlines[0] ?? null) }
    }
    updateDeadline()
    window.addEventListener(PERSONAL_DEADLINES_CHANGED, updateDeadline)
    return () => window.removeEventListener(PERSONAL_DEADLINES_CHANGED, updateDeadline)
  }, [])

  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5',
        className,
      )}
      aria-label="Key upcoming dates"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palmtree className="size-4 text-primary" />
          Key dates
        </h2>
        {onOpenCalendar && (
          <button
            type="button"
            onClick={onOpenCalendar}
            className="text-xs font-medium text-muted-foreground transition hover:text-primary"
          >
            View calendar
          </button>
        )}
      </div>

      {events === null ? (
        // Stable placeholder to avoid layout shift / hydration mismatch.
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          No upcoming dates on the academic calendar.
        </p>
      ) : (
        <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
          {events.map((ev) => {
            const meta = CAL_TYPE_META[ev.type]
            const soon = ev.daysUntil <= 3
            const Icon = ev.type === 'holiday' ? HolidayIcon : School
            return (
              <motion.li
                key={`${ev.date}-${ev.type}`}
                variants={riseItem}
                className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="relative flex size-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: meta.soft, color: meta.text }}
                >
                  <Icon {...(ev.type === 'holiday' ? { label: ev.label } : {})} className="absolute -right-1 -top-1 size-3 rounded-full bg-card p-0.5" style={{ color: meta.solid }} />
                  {shortDate(ev.date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{ev.label}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: meta.solid }}
                      aria-hidden
                    />
                    {meta.label}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
                    soon ? 'text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                  style={soon ? { backgroundColor: meta.solid, color: 'var(--card)' } : undefined}
                >
                  {countdownPhrase(ev.daysUntil)}
                </span>
              </motion.li>
            )
          })}
          {personalDeadline && (
            <motion.li key={personalDeadline.id} variants={riseItem} className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Flag className="size-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{personalDeadline.title}</p><p className="text-xs text-muted-foreground">Personal deadline</p></div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">{deadlineDateLabel(personalDeadline.date)}</span>
            </motion.li>
          )}
        </motion.ul>
      )}
    </section>
  )
}

/** "SEP 10" style two-line-safe short date badge. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
  })
  return `${month} ${d}`
}
