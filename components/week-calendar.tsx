'use client'

import { motion } from 'motion/react'
import { FlaskConical } from 'lucide-react'
import {
  courseClass,
  formatMinutes,
  timetable,
  weekByIndex,
  type TimetableEvent,
} from '@/lib/timetable'
import { blockedInfo } from '@/lib/academic-calendar'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HolidayIcon } from '@/components/holiday-icon'

// Subtle diagonal hatch used to mark holiday / break days.
const HATCH =
  'repeating-linear-gradient(45deg, color-mix(in oklch, var(--muted-foreground) 12%, transparent) 0, color-mix(in oklch, var(--muted-foreground) 12%, transparent) 6px, transparent 6px, transparent 12px)'

const HOUR_HEIGHT = 76 // px per hour on desktop
const PPM = HOUR_HEIGHT / 60

interface WeekCalendarProps {
  events: TimetableEvent[]
  activeCourse: string | null
  weekIndex: number
  isCurrentWeek: boolean
  todayIndex: number
  nowMinutes: number | null
  onSelect: (event: TimetableEvent) => void
}

export function WeekCalendar({
  events,
  activeCourse,
  weekIndex,
  isCurrentWeek,
  todayIndex,
  nowMinutes,
  onSelect,
}: WeekCalendarProps) {
  const { days } = timetable.meta
  const startMin = timetable.meta.timeRange.startMin
  const endMin = timetable.meta.timeRange.endMin
  const totalHeight = (endMin - startMin) * PPM
  const week = weekByIndex(weekIndex)
  const effectiveToday = isCurrentWeek ? todayIndex : -1

  // Hour marks (whole hours within range)
  const hours: number[] = []
  for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 60) hours.push(m)

  const showNow =
    nowMinutes !== null &&
    effectiveToday >= 0 &&
    nowMinutes >= startMin &&
    nowMinutes <= endMin

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Header row */}
      <div
        className="grid border-b border-border bg-muted/40"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="border-r border-border" aria-hidden />
        {days.map((day, i) => {
          const cell = week?.days[i]
          const isToday = i === effectiveToday
          const blocked = cell ? blockedInfo(cell.ms) : { blocked: false, type: null, label: null }
          return (
            <div
              key={day}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 border-r border-border py-2.5 text-sm font-semibold last:border-r-0',
                isToday ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.slice(0, 3)}</span>
                {isToday && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                    Today
                  </span>
                )}
              </span>
              {cell && (
                <span
                  className={cn(
                    'text-[11px] font-medium tabular-nums',
                    isToday ? 'text-primary/80' : 'text-muted-foreground/70',
                  )}
                >
                  {cell.dateShort}
                </span>
              )}
              {blocked.blocked && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: `var(--cal-${blocked.type === 'end-term' ? 'end' : blocked.type === 'break' ? 'break' : 'holiday'}-soft)`,
                    color: `var(--cal-${blocked.type === 'end-term' ? 'end' : blocked.type === 'break' ? 'break' : 'holiday'}-text)`,
                  }}
                  title={blocked.label ?? undefined}
                >
                  {blocked.type === 'end-term' ? 'End Term' : blocked.type === 'break' ? 'Break' : 'Holiday'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Body */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {/* Time gutter */}
        <div className="relative border-r border-border" style={{ height: totalHeight }}>
          {hours.map((m) => (
            <div
              key={m}
              className="absolute -translate-y-1/2 pr-2 text-right text-[11px] font-medium tabular-nums text-muted-foreground"
              style={{ top: (m - startMin) * PPM, right: 0, left: 0 }}
            >
              {formatMinutes(m)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, dayIdx) => {
          const dayCell = week?.days[dayIdx]
          const blocked = dayCell
            ? blockedInfo(dayCell.ms)
            : { blocked: false, type: null, label: null }
          // On holidays/breaks/end-term exam days the timetable stays in sync with the academic
          // calendar: no normal class cards render even if the weekly grid has one.
          const dayEvents = blocked.blocked
            ? []
            : events.filter((e) => e.dayIndex === dayIdx)
          return (
            <div
              key={day}
              className={cn(
                'relative border-r border-border last:border-r-0',
                dayIdx === effectiveToday && 'bg-primary/[0.035]',
                blocked.blocked && 'bg-muted/30',
              )}
              style={{ height: totalHeight }}
            >
              {/* hour gridlines */}
              {hours.map((m) => (
                <div
                  key={m}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: (m - startMin) * PPM }}
                  aria-hidden
                />
              ))}

              {/* holiday / break / end-term overlay — greys the column and labels it */}
              {blocked.blocked && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-1 text-center"
                  style={{ backgroundImage: HATCH }}
                >
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: `var(--cal-${blocked.type === 'end-term' ? 'end' : blocked.type === 'break' ? 'break' : 'holiday'})`,
                      color: 'var(--card)',
                    }}
                  >
                    {blocked.type === 'end-term' ? 'End Term' : blocked.type === 'break' ? 'Break' : 'Holiday'}
                  </span>
                  {blocked.type === 'holiday' && <HolidayIcon label={blocked.label} className="size-4" style={{ color: 'var(--cal-holiday)' }} />}
                  {blocked.label && (
                    <span className="text-pretty text-[10px] font-medium leading-tight text-muted-foreground">
                      {blocked.label}
                    </span>
                  )}
                </div>
              )}

              {/* events */}
              {dayEvents.map((event, i) => {
                const top = (event.startMin - startMin) * PPM
                const height = Math.max(event.durationMin * PPM - 3, 22)
                const dimmed = activeCourse !== null && event.courseId !== activeCourse

                if (event.type === 'break') {
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'absolute inset-x-1 flex items-center justify-center rounded-md border border-dashed border-border bg-muted/50 text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
                        dimmed && 'opacity-30',
                      )}
                      style={{ top, height }}
                    >
                      {height > 30 ? 'Lunch' : ''}
                    </div>
                  )
                }

                return (
                  <motion.button
                    key={event.id}
                    type="button"
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: dimmed ? 0.25 : 1, y: 0, scale: 1 }}
                    transition={{ ...spring, delay: Math.min(i * 0.02 + dayIdx * 0.01, 0.25) }}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onSelect(event)}
                    className={cn(
                      courseClass(event.courseId),
                      'group absolute inset-x-1 flex flex-col overflow-hidden rounded-lg border border-l-[3px] border-[color:var(--c-border)] border-l-[color:var(--c-bar)] bg-[color:var(--c-soft)] px-2 py-1 text-left',
                      'hover:z-10 hover:shadow-md focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    style={{ top, height }}
                    title={`${event.courseName} · ${event.startLabel}–${event.endLabel}`}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-semibold leading-tight text-[color:var(--c-text)]">
                      <span className="truncate">{event.code}</span>
                      {event.isLab && (
                        <FlaskConical className="size-3 shrink-0 opacity-80" />
                      )}
                    </span>
                    {height > 42 && (
                      <span className="truncate text-[10px] leading-tight text-[color:var(--c-text)]/80">
                        {event.faculty}
                      </span>
                    )}
                    {height > 58 && (
                      <span className="mt-auto truncate text-[10px] leading-tight text-[color:var(--c-text)]/70">
                        {event.room}
                      </span>
                    )}
                  </motion.button>
                )
              })}

              {/* now indicator */}
              {showNow && dayIdx === effectiveToday && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0.9 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={spring}
                  className="pointer-events-none absolute inset-x-0 z-20"
                  style={{ top: (nowMinutes! - startMin) * PPM }}
                  aria-hidden
                >
                  <div className="relative border-t-2 border-primary">
                    <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-primary" />
                  </div>
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
