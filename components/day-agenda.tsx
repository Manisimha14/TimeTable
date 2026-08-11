'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleX, Clock, FlaskConical, MapPin, User } from 'lucide-react'
import {
  ATTENDANCE_CHANGED_EVENT,
  courseClass,
  formatDuration,
  getAttendanceLog,
  timetable,
  weekByIndex,
  type AttendanceStatus,
  type TimetableEvent,
} from '@/lib/timetable'
import { blockedInfo, type BlockedInfo } from '@/lib/academic-calendar'
import { spring, staggerContainer, riseItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HolidayIcon } from '@/components/holiday-icon'

interface DayAgendaProps {
  events: TimetableEvent[]
  activeCourse: string | null
  selectedDay: number
  weekIndex: number
  isCurrentWeek: boolean
  todayIndex: number
  onSelectDay: (day: number) => void
  onSelect: (event: TimetableEvent) => void
}

export function DayAgenda({
  events,
  activeCourse,
  selectedDay,
  weekIndex,
  isCurrentWeek,
  todayIndex,
  onSelectDay,
  onSelect,
}: DayAgendaProps) {
  const { days } = timetable.meta
  const week = weekByIndex(weekIndex)
  const effectiveToday = isCurrentWeek ? todayIndex : -1
  const selectedCell = week?.days[selectedDay]
  const selectedBlocked = selectedCell
    ? blockedInfo(selectedCell.ms)
    : { blocked: false, type: null, label: null }

  const [log, setLog] = useState<Record<string, AttendanceStatus>>({})
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
  }, [])

  useEffect(() => {
    const updateLog = () => setLog(getAttendanceLog())
    updateLog()
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
    return () => window.removeEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
  }, [])

  const todayMs = now ? Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) : null
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0

  // Holidays / breaks suppress all class cards so the agenda mirrors the calendar.
  const dayEvents = selectedBlocked.blocked
    ? []
    : events
        .filter((e) => e.dayIndex === selectedDay)
        .filter((e) => (activeCourse ? e.courseId === activeCourse || e.type === 'break' : true))
        .filter((e) => e.type === 'class')

  return (
    <div className="space-y-4">
      {/* Day selector */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {days.map((day, i) => {
          const cell = week?.days[i]
          const isSelected = i === selectedDay
          const dayBlock: BlockedInfo = cell
            ? blockedInfo(cell.ms)
            : { blocked: false, type: null, label: null }
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(i)}
              aria-pressed={isSelected}
              className={cn(
                'relative flex min-w-[58px] flex-1 flex-col items-center rounded-xl border px-2 py-2 text-sm font-medium transition sm:min-w-[64px]',
                isSelected
                  ? 'border-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40',
              )}
            >
              {isSelected && (
                <motion.span
                  layoutId="agenda-day-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-xl bg-primary"
                />
              )}
              <span className="relative">{day.slice(0, 3)}</span>
              {cell && (
                <span
                  className={cn(
                    'relative text-[11px] tabular-nums',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground/70',
                  )}
                >
                  {cell.dayNum}
                </span>
              )}
              {i === effectiveToday && (
                <span
                  className={cn(
                    'relative mt-0.5 text-[9px] font-bold uppercase tracking-wide',
                    isSelected ? 'text-primary-foreground/80' : 'text-primary',
                  )}
                >
                  Today
                </span>
              )}
              {dayBlock.blocked && i !== effectiveToday && (
                <HolidayIcon
                  label={dayBlock.label}
                  className="relative mt-1 size-3"
                  style={{ color: `var(--cal-${dayBlock.type === 'break' ? 'break' : 'holiday'})` }}
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Events */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${weekIndex}-${selectedDay}`}
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {selectedBlocked.blocked ? (
            <motion.div
              variants={riseItem}
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center"
              style={{
                backgroundColor: `var(--cal-${selectedBlocked.type === 'end-term' ? 'end' : selectedBlocked.type === 'break' ? 'break' : 'holiday'}-soft)`,
              }}
            >
              <HolidayIcon
                label={selectedBlocked.label}
                className="size-7"
                style={{
                  color: `var(--cal-${selectedBlocked.type === 'end-term' ? 'end' : selectedBlocked.type === 'break' ? 'break' : 'holiday'}-text)`,
                }}
              />
              <span
                className="rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: `var(--cal-${selectedBlocked.type === 'end-term' ? 'end' : selectedBlocked.type === 'break' ? 'break' : 'holiday'})`,
                  color: 'var(--card)',
                }}
              >
                {selectedBlocked.type === 'end-term'
                  ? 'End Term Exam Day'
                  : selectedBlocked.type === 'break'
                    ? 'Break'
                    : 'Holiday'}
              </span>
              <p
                className="px-4 text-sm font-semibold"
                style={{
                  color: `var(--cal-${selectedBlocked.type === 'end-term' ? 'end' : selectedBlocked.type === 'break' ? 'break' : 'holiday'}-text)`,
                }}
              >
                {selectedBlocked.label ?? 'End Term Exam Day'}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedBlocked.type === 'end-term'
                  ? 'End-term exams scheduled. Regular classes and labs suspended.'
                  : `No classes on ${days[selectedDay]}.`}
              </p>
            </motion.div>
          ) : dayEvents.length === 0 ? (
            <motion.p
              variants={riseItem}
              className="rounded-xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground"
            >
              No classes scheduled for {days[selectedDay]}.
            </motion.p>
          ) : (
            dayEvents.map((event) => {
              const occKey = `${event.id}|${weekIndex}`
              const isCompleted =
                selectedCell &&
                todayMs !== null &&
                (selectedCell.ms < todayMs ||
                  (selectedCell.ms === todayMs && event.endMin <= nowMinutes))
              const status = isCompleted ? (log[occKey] ?? null) : null

              return (
                <motion.button
                  key={event.id}
                  variants={riseItem}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  onClick={() => onSelect(event)}
                  className={cn(
                    courseClass(event.courseId),
                    'group relative flex w-full items-stretch gap-3 rounded-2xl border-2 border-[color:var(--c-border,var(--border))] bg-card p-3 text-left transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4 sm:p-4',
                  )}
                >
                  {/* Left: Time column */}
                  <div className="flex w-[4.4rem] shrink-0 flex-col items-start justify-center space-y-1 sm:w-20">
                    <span className="text-sm font-bold tracking-tight text-foreground">
                      {event.startLabel}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {event.endLabel}
                    </span>
                    <span className="mt-1.5 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {formatDuration(event.durationMin)}
                    </span>
                  </div>

                  {/* Right: Content */}
                  <div className="min-w-0 flex-1">
                    {/* Badge row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-lg bg-[color:var(--c-solid)] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                        {event.code}
                      </span>
                      {event.isLab && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-semibold text-[color:var(--c-text)]">
                          <FlaskConical className="size-3.5" /> Lab
                        </span>
                      )}
                      {isCompleted && (
                        status === 'present' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3" /> Present
                          </span>
                        ) : status === 'missed' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                            <CircleX className="size-3" /> Missed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Clock className="size-3" /> Unlogged
                          </span>
                        )
                      )}
                    </div>

                  {/* Title */}
                  <p className="mt-2 line-clamp-2 text-base font-bold text-foreground">
                    {event.courseName}
                  </p>

                  {/* Details */}
                  <div className="mt-2.5 space-y-1">
                    {event.faculty && (
                      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <User className="size-4 flex-shrink-0" /> {event.faculty}
                      </span>
                    )}
                    {event.room && (
                      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <MapPin className="size-4 flex-shrink-0" /> {event.room}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right accent bar */}
                <span
                  className={cn(
                    courseClass(event.courseId),
                    'absolute right-0 top-0 h-full w-1.5 rounded-r-2xl bg-[color:var(--c-bar)]',
                  )}
                  aria-hidden
                />
              </motion.button>
            )
          })
        )}
      </motion.div>
    </AnimatePresence>
  </div>
)
}
