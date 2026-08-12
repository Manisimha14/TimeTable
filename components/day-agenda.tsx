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

  const [log, setLog] = useState<Record<string, AttendanceStatus>>(() => {
    if (typeof window === 'undefined') return {}
    return getAttendanceLog()
  })
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const updateLog = () => setLog(getAttendanceLog())
    updateLog()
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
    return () => window.removeEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
  }, [])

  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  // Holidays / breaks suppress all class cards so the agenda mirrors the calendar.
  const dayEvents = selectedBlocked.blocked
    ? []
    : events
        .filter((e) => e.dayIndex === selectedDay)
        .filter((e) => (activeCourse ? e.courseId === activeCourse || e.type === 'break' : true))
        .filter((e) => e.type === 'class')

  return (
    <div className="space-y-4">
      {/* Day selector - iOS Segmented Style */}
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto rounded-2xl border border-border/60 bg-muted/40 p-1.5 shadow-xs backdrop-blur-xs">
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
                'relative flex min-w-[54px] flex-1 flex-col items-center justify-center rounded-xl py-2 text-xs font-semibold transition active:scale-95 sm:min-w-[64px]',
                isSelected
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {isSelected && (
                <motion.span
                  layoutId="agenda-day-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                />
              )}
              <span className="relative flex items-center gap-1">
                <span>{day.slice(0, 3)}</span>
                {i === effectiveToday && (
                  <span
                    className={cn(
                      'size-1.5 rounded-full animate-pulse',
                      isSelected ? 'bg-primary-foreground' : 'bg-primary',
                    )}
                  />
                )}
              </span>
              {cell && (
                <span
                  className={cn(
                    'relative text-[11px] tabular-nums mt-0.5',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground/70',
                  )}
                >
                  {cell.dayNum}
                </span>
              )}
              {dayBlock.blocked && (
                <HolidayIcon
                  label={dayBlock.label}
                  className="relative mt-0.5 size-3"
                  style={{ color: isSelected ? 'currentColor' : `var(--cal-${dayBlock.type === 'break' ? 'break' : 'holiday'})` }}
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Events List */}
      <motion.div
        key={`${weekIndex}-${selectedDay}`}
        initial={{ opacity: 0.8, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.1 }}
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
              className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-sm font-medium text-muted-foreground shadow-xs"
            >
              No classes scheduled for {days[selectedDay]}.
            </motion.p>
          ) : (
            dayEvents.map((event) => {
              const occKey = `${event.id}|${weekIndex}`
              const isCompleted =
                selectedCell &&
                (selectedCell.ms < todayMs ||
                  (selectedCell.ms === todayMs && event.endMin <= nowMinutes))
              const status = isCompleted ? (log[occKey] ?? null) : null

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelect(event)}
                  className={cn(
                    courseClass(event.courseId),
                    'group relative flex w-full items-stretch gap-3.5 rounded-2xl border border-border/80 bg-card p-3.5 text-left shadow-xs transition-colors hover:border-primary/40 active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4',
                    isCompleted && 'opacity-75 hover:opacity-100',
                  )}
                >
                  {/* Course Left Brand Indicator */}
                  <span
                    className="w-1.5 shrink-0 self-stretch rounded-full bg-[color:var(--c-solid)] shadow-xs"
                    aria-hidden
                  />

                  {/* Left: Time column */}
                  <div className="flex w-16 shrink-0 flex-col items-start justify-center space-y-1 sm:w-20">
                    <span className={cn("text-sm font-bold tracking-tight text-foreground", isCompleted && "opacity-70")}>
                      {event.startLabel}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {event.endLabel}
                    </span>
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {formatDuration(event.durationMin)}
                    </span>
                  </div>

                  {/* Right: Content */}
                  <div className="min-w-0 flex-1 py-0.5">
                    {/* Badge row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("inline-flex items-center rounded-lg bg-[color:var(--c-solid)] px-2.5 py-0.5 text-xs font-bold text-white shadow-xs", isCompleted && "line-through opacity-80")}>
                        {event.code}
                      </span>
                      {event.isLab && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                          <FlaskConical className="size-3" /> Lab
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
                    <p className={cn("mt-1.5 line-clamp-2 text-sm font-bold text-foreground sm:text-base", isCompleted && "line-through opacity-70")}>
                      {event.courseName}
                    </p>

                    {/* Details */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
                      {event.faculty && (
                        <span className="flex items-center gap-1.5">
                          <User className="size-3.5 shrink-0 text-primary/70" /> {event.faculty}
                        </span>
                      )}
                      {event.room && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0 text-primary/70" /> {event.room}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </motion.div>
    </div>
  )
}
