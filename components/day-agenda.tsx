'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarPlus, Check, CircleX, Clock, FlaskConical, MapPin, Plus, User } from 'lucide-react'
import {
  ATTENDANCE_CHANGED_EVENT,
  courseClass,
  formatDuration,
  fullDateLabel,
  getAttendanceLog,
  timetable,
  weekByIndex,
  type AttendanceStatus,
  type CourseId,
  type TimetableEvent,
} from '@/lib/timetable'
import { blockedInfo, type BlockedInfo } from '@/lib/academic-calendar'
import { addPersonalDeadline, deadlineDateLabel } from '@/lib/personal-deadlines'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { spring, staggerContainer, riseItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HolidayIcon } from '@/components/holiday-icon'
import { triggerHaptic } from '@/lib/haptics'

import { getScheduleOverrides, SCHEDULE_OVERRIDES_CHANGED } from '@/lib/schedule-overrides'

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

  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalNote, setModalNote] = useState('')
  const [modalPriority, setModalPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [modalCourseId, setModalCourseId] = useState<CourseId | 'general'>('general')
  const [modalDateIso, setModalDateIso] = useState<string>(() => new Date().toISOString().slice(0, 10))

  const [overridesVersion, setOverridesVersion] = useState(0)
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
    const updateOverrides = () => setOverridesVersion((v) => v + 1)
    updateLog()
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
    return () => {
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
      window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
    }
  }, [])

  const overrides = getScheduleOverrides()
  const cancelKeys = new Set(
    overrides.filter((o) => o.type === 'cancel' || o.type === 'reschedule').map((o) => o.originalKey),
  )

  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  // Holidays / breaks suppress all class cards so the agenda mirrors the calendar.
  const dayEvents = selectedBlocked.blocked
    ? []
    : events
        .filter((e) => e.dayIndex === selectedDay)
        .filter((e) => (activeCourse ? e.courseId === activeCourse || e.type === 'break' : true))
        .filter((e) => e.type === 'class')

  const getHolidayMeme = (label: string | null, type: string | null) => {
    if (type === 'end-term') return 'Inka End Term Exams start! Book open cheyyi raa bujji 📚⚡'
    if (label?.toLowerCase().includes('independence')) return 'August 15 Independence Day! Desk ni vadilesi biryani thinu masteru 🍗✨'
    if (label?.toLowerCase().includes('ganesh')) return 'Ganesh Chaturthi festival vibe! No lectures today, laddu thini rest theesuko! 🙏🎊'
    if (label?.toLowerCase().includes('gandhi')) return 'October 2 Gandhi Jayanti Holiday! Full peaceful day no attendance stress 🕊️✨'
    if (label?.toLowerCase().includes('dussehra') || label?.toLowerCase().includes('bathukamma')) return 'Dussehra / Bathukamma Break! Festival mood, enjoy with family & friends! 🌺🪔'
    return 'Aaj Holiday ka feeling! Zero classes today, chill & relax bro! 🥳🎉'
  }

  return (
    <div className="space-y-4">
      {/* Day selector - iOS Segmented Style with Haptic touch */}
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
              onClick={() => {
                triggerHaptic('medium')
                onSelectDay(i)
              }}
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
          {selectedBlocked.blocked || dayEvents.length === 0 ? (
            <motion.div
              variants={riseItem}
              whileTap={{ scale: 0.98 }}
              onClick={() => triggerHaptic('success')}
              className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border-2 border-amber-500/40 dark:border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-card to-purple-500/10 p-6 sm:p-8 text-center shadow-lg transition-all hover:shadow-xl active:scale-[0.98] cursor-pointer"
            >
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all" />
              <HolidayIcon
                label={selectedBlocked.label ?? (selectedDay === 6 ? 'Sunday Rest Day' : 'No Classes Scheduled')}
                className="size-10 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-110"
              />
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {selectedBlocked.type === 'end-term'
                  ? 'End Term Exam Day 📚'
                  : selectedBlocked.type === 'break'
                    ? 'Official Break 🏖️'
                    : selectedDay === 6
                      ? 'Sunday Rest Day ☀️'
                      : 'Holiday / No Classes 🥳'}
              </span>
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-extrabold text-foreground">
                  {selectedBlocked.label ?? (selectedDay === 6 ? 'Sunday — Rest & Self Study' : `Free Day on ${days[selectedDay]}`)}
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {getHolidayMeme(selectedBlocked.label, selectedBlocked.type)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                {selectedBlocked.type === 'end-term'
                  ? 'End-term exams scheduled. Regular lectures and lab sessions are suspended.'
                  : `No classes scheduled on ${days[selectedDay]}. Enjoy your free time or catch up on self-study!`}
              </p>
            </motion.div>
          ) : (
            dayEvents.map((event) => {
              const occKey = `${event.id}|${weekIndex}`
              const isCompleted =
                selectedCell &&
                (selectedCell.ms < todayMs ||
                  (selectedCell.ms === todayMs && event.endMin <= nowMinutes))
              const status = isCompleted ? (log[occKey] ?? null) : null

              const isRescheduled = cancelKeys.has(occKey)

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light')
                    onSelect(event)
                  }}
                  className={cn(
                    courseClass(event.courseId),
                    'group relative flex w-full items-stretch gap-3.5 rounded-2xl border border-border/80 bg-card p-3.5 text-left shadow-xs transition-all hover:border-primary/40 active:scale-[0.985] active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4',
                    (isCompleted || isRescheduled) && 'opacity-75 hover:opacity-100',
                  )}
                >
                  {/* Course Left Brand Indicator */}
                  <span
                    className="w-1.5 shrink-0 self-stretch rounded-full bg-[color:var(--c-solid)] shadow-xs"
                    aria-hidden
                  />

                  {/* Left: Time column */}
                  <div className="flex w-16 shrink-0 flex-col items-start justify-center space-y-1 sm:w-20">
                    <span className={cn("text-sm font-bold tracking-tight text-foreground", (isCompleted || isRescheduled) && "opacity-70")}>
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
                      <span className={cn("inline-flex items-center rounded-lg bg-[color:var(--c-solid)] px-2.5 py-0.5 text-xs font-bold text-white shadow-xs", (isCompleted || isRescheduled) && "line-through opacity-80")}>
                        {event.code}
                      </span>
                      {event.isLab && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                          <FlaskConical className="size-3" /> Lab
                        </span>
                      )}
                      {event.rescheduledToIso ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          ⏩ Rescheduled to {deadlineDateLabel(event.rescheduledToIso)}
                        </span>
                      ) : event.rescheduledFromIso ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          🔄 Rescheduled from {deadlineDateLabel(event.rescheduledFromIso)}
                        </span>
                      ) : isCompleted ? (
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
                      ) : null}
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

          {/* Quick Add Deadline button for selected date */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium')
              if (selectedCell) {
                const d = new Date(selectedCell.ms)
                const y = d.getUTCFullYear()
                const m = String(d.getUTCMonth() + 1).padStart(2, '0')
                const dateNum = String(d.getUTCDate()).padStart(2, '0')
                setModalDateIso(`${y}-${m}-${dateNum}`)
              }
              setDeadlineModalOpen(true)
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 py-3 text-xs font-bold text-primary transition hover:bg-primary/10 active:scale-[0.985]"
          >
            <Plus className="size-4" /> Add Personal Deadline for {selectedCell ? fullDateLabel(selectedCell.ms) : days[selectedDay]}
          </button>
        </motion.div>

      {/* Add Deadline Dialog */}
      <Dialog open={deadlineModalOpen} onOpenChange={setDeadlineModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <CalendarPlus className="size-5 text-primary" /> Add Deadline for {deadlineDateLabel(modalDateIso)}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a personal task or assignment due on this specific date.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!modalTitle.trim() || !modalDateIso) return
              addPersonalDeadline({
                title: modalTitle.trim(),
                date: modalDateIso,
                note: modalNote.trim(),
                priority: modalPriority,
                courseId: modalCourseId,
              })
              triggerHaptic('success')
              setModalTitle('')
              setModalNote('')
              setDeadlineModalOpen(false)
            }}
            className="mt-3 space-y-3"
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Task Title *</label>
              <input
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. MERN Lab Report / Quiz Prep"
                required
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                <select
                  value={modalPriority}
                  onChange={(e) => setModalPriority(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🔵 Low</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Subject</label>
                <select
                  value={modalCourseId}
                  onChange={(e) => setModalCourseId(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                >
                  <option value="general">General</option>
                  <option value="cml">CML</option>
                  <option value="mern">MERN</option>
                  <option value="cn">CN</option>
                  <option value="fdsa">FDSA</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Optional Notes</label>
              <textarea
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                placeholder="Details or submission links"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDeadlineModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 font-bold">
                Save Deadline
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
