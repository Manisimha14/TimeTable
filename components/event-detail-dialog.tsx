'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  MapPin,
  User,
  Clock,
  CalendarDays,
  FlaskConical,
  BookOpen,
  ArrowUpRight,
  Link2,
  Check,
  CircleX,
  ShieldCheck,
  Lock,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  ATTENDANCE_CHANGED_EVENT,
  courseById,
  courseClass,
  dayCellFor,
  formatDuration,
  fullDateLabel,
  getAttendanceLog,
  saveAttendanceLog,
  sessionFor,
  type AttendanceStatus,
  type GroupKey,
  type TimetableEvent,
} from '@/lib/timetable'
import { staggerContainer, riseItem } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface EventDetailDialogProps {
  event: TimetableEvent | null
  group: GroupKey
  lockedGroup?: GroupKey | null
  groupLabel: string
  weekIndex: number
  onOpenChange: (open: boolean) => void
  onViewCourse: (courseId: string) => void
  onOpenRescheduler?: (eventKey: string) => void
}

export function EventDetailDialog({
  event,
  group,
  lockedGroup,
  groupLabel,
  weekIndex,
  onOpenChange,
  onViewCourse,
  onOpenRescheduler,
}: EventDetailDialogProps) {
  const open = event !== null && event.type === 'class'
  const course = event ? courseById(event.courseId) : undefined
  // Labs are never mapped to a syllabus session — only theory classes are.
  const result = event && !event.isLab ? sessionFor(group, event, weekIndex) : null
  const cell = event ? dayCellFor(event, weekIndex) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        {event && (
          <div className={cn('flex max-h-[90vh] flex-col', courseClass(event.courseId))}>
            {/* Header */}
            <DialogHeader className="relative space-y-3 border-b border-[color:var(--c-border)] bg-[color:var(--c-soft)] p-5 text-left sm:p-6">
              <DialogClose className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground/80 hover:bg-black/5 hover:text-foreground transition active:scale-95 focus:outline-none">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-[color:var(--c-solid)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                  {event.code}
                </span>
                {event.isLab && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--c-border)] bg-background/60 px-2 py-0.5 text-xs font-medium text-[color:var(--c-text)]">
                    <FlaskConical className="size-3" /> Lab
                  </span>
                )}
              </div>
              <DialogTitle className="font-display text-lg leading-tight text-balance text-[color:var(--c-text)] sm:text-xl">
                {event.courseName}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Class details and the session taught for {event.courseName} in week {weekIndex}
              </DialogDescription>
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm text-[color:var(--c-text)] sm:grid-cols-2">
                <InfoRow
                  icon={CalendarDays}
                  label={cell ? fullDateLabel(cell.ms) : `${event.day} · ${groupLabel}`}
                />
                <InfoRow
                  icon={Clock}
                  label={`${event.startLabel} – ${event.endLabel} (${formatDuration(event.durationMin)})`}
                />
                {event.faculty && <InfoRow icon={User} label={event.faculty} />}
                {event.room && <InfoRow icon={MapPin} label={event.room} />}
              </div>
            </DialogHeader>

            {/* Body */}
            <ScrollArea className="flex-1">
              <motion.div
                key={`${event.id}-${weekIndex}`}
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-5 p-5 sm:p-6"
              >
                {/* Lab: no syllabus session is mapped */}
                {event.isLab ? (
                  <motion.section variants={riseItem}>
                    <SectionHeading icon={FlaskConical}>Lab session</SectionHeading>
                    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[color:var(--c-border)] bg-[color:var(--c-soft)]/50 p-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--c-solid)] text-white">
                        <FlaskConical className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          Hands-on lab
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Practical lab slot for {event.courseName}. Lab sessions are not tied
                          to the theory syllabus schedule.
                        </p>
                      </div>
                    </div>
                  </motion.section>
                ) : (
                  /* This session */
                  <motion.section variants={riseItem}>
                    <div className="flex items-center justify-between gap-2">
                      <SectionHeading icon={BookOpen}>This session</SectionHeading>
                      {result && result.total > 0 && (
                        <span className="rounded-full bg-[color:var(--c-soft)] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[color:var(--c-text)]">
                          {Math.min(result.sessionNumber, result.total)} / {result.total}
                        </span>
                      )}
                    </div>

                    {result?.session ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--c-border)] bg-[color:var(--c-soft)]/50">
                        <div className="flex items-start gap-3 border-b border-[color:var(--c-border)]/70 p-4">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--c-solid)] text-sm font-bold text-white">
                            {result.session.number || result.sessionNumber}
                          </span>
                          <p className="min-w-0 text-sm font-semibold leading-snug text-pretty text-foreground">
                            {result.session.title}
                          </p>
                        </div>
                        {(result.session.topics.length > 0 || result.session.assignments) && (
                          <div className="p-4">
                            {result.session.topics.length > 0 && (
                              <ul className="space-y-2">
                                {result.session.topics.map((t, j) => (
                                  <li
                                    key={j}
                                    className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                                  >
                                    <span
                                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[color:var(--c-solid)]"
                                      aria-hidden
                                    />
                                    <span className="min-w-0">{t}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {result.session.assignments && (
                              <AssignmentLink href={result.session.assignments} />
                            )}
                          </div>
                        )}
                      </div>
                    ) : result?.beyondSyllabus ? (
                      <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        This occurrence falls beyond the {result.total} planned syllabus
                        sessions — likely revision, buffer or assessment time.
                      </p>
                    ) : (
                      <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        No mapped syllabus session for this activity.
                      </p>
                    )}
                  </motion.section>
                )}

                {/* Attendance logger for completed session */}
                {cell && (
                  <AttendanceSection
                    occurrenceKey={`${event.id}|${weekIndex}`}
                    cellMs={cell.ms}
                    endMin={event.endMin}
                    group={group}
                    lockedGroup={lockedGroup}
                  />
                )}

                {cell && (
                  <SessionNotesSection
                    occurrenceKey={`${event.id}|${weekIndex}`}
                  />
                )}

                {/* Reschedule or Cancel button */}
                {onOpenRescheduler && (
                  <motion.div variants={riseItem}>
                    <Button
                      variant="secondary"
                      className="w-full justify-between border border-border"
                      onClick={() => {
                        onOpenRescheduler(`${event.id}|${weekIndex}`)
                        onOpenChange(false)
                      }}
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold">
                        <CalendarDays className="size-4 text-primary" />
                        Reschedule or cancel this class
                      </span>
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </motion.div>
                )}

                {/* Route to the full course */}
                {course && course.sessions.length > 0 && (
                  <motion.div variants={riseItem}>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => {
                        onViewCourse(course.id)
                        onOpenChange(false)
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="size-4" />
                        View full course · {course.sessions.length} sessions
                      </span>
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AssignmentLink({ href }: { href: string }) {
  const isUrl = /^https?:\/\//.test(href)
  if (!isUrl) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Assignment:</span> {href}
      </p>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--c-border)] bg-background px-2.5 py-1.5 text-xs font-medium text-[color:var(--c-text)] transition hover:brightness-95"
    >
      <Link2 className="size-3.5" />
      Open assignment
      <ArrowUpRight className="size-3.5" />
    </a>
  )
}

function InfoRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
    </span>
  )
}

function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode
  icon?: React.ElementType
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {Icon && <Icon className="size-3.5" />}
      {children}
    </h3>
  )
}

function AttendanceSection({
  occurrenceKey,
  cellMs,
  endMin,
  group,
  lockedGroup,
}: {
  occurrenceKey: string
  cellMs: number
  endMin: number
  group: GroupKey
  lockedGroup?: GroupKey | null
}) {
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

  const isCompleted =
    todayMs !== null &&
    (cellMs < todayMs || (cellMs === todayMs && endMin <= nowMinutes))

  if (!isCompleted) return null

  if (lockedGroup && lockedGroup !== group) {
    return (
      <motion.section variants={riseItem}>
        <SectionHeading icon={ShieldCheck}>Session attendance log</SectionHeading>
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <Lock className="size-4 shrink-0 text-amber-600" />
          <span>
            Attendance logging is locked to primary <strong>Group {lockedGroup}</strong>. Switch back to Group {lockedGroup} or unlock it to log attendance for Group {group}.
          </span>
        </div>
      </motion.section>
    )
  }

  const currentStatus = log[occurrenceKey] ?? null

  const setStatus = (status: AttendanceStatus | null) => {
    const next = { ...log }
    if (status === null) {
      delete next[occurrenceKey]
    } else {
      next[occurrenceKey] = status
    }
    setLog(next)
    saveAttendanceLog(next)
  }

  return (
    <motion.section variants={riseItem}>
      <SectionHeading icon={ShieldCheck}>Session attendance log</SectionHeading>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--c-border)] bg-[color:var(--c-soft)]/50 p-4">
        <div>
          <p className="text-xs font-semibold text-foreground">
            {currentStatus === 'present'
              ? 'Logged as Present'
              : currentStatus === 'missed'
                ? 'Logged as Missed'
                : 'Session completed — unlogged'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Update your attendance status for this class
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatus('present')}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
              currentStatus === 'present'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'border border-border bg-background text-foreground hover:border-emerald-500/50',
            )}
          >
            <Check className="size-3.5" /> Present
          </button>
          <button
            type="button"
            onClick={() => setStatus('missed')}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
              currentStatus === 'missed'
                ? 'bg-destructive text-destructive-foreground shadow-xs'
                : 'border border-border bg-background text-foreground hover:border-destructive/50',
            )}
          >
            <CircleX className="size-3.5" /> Missed
          </button>
        </div>
      </div>
    </motion.section>
  )
}

function SessionNotesSection({ occurrenceKey }: { occurrenceKey: string }) {
  const [rating, setRating] = useState<number>(0)
  const [note, setNote] = useState<string>('')

  useEffect(() => {
    try {
      const savedRatings = window.localStorage.getItem('academic-dashboard-session-ratings')
      if (savedRatings) {
        const parsed = JSON.parse(savedRatings)
        if (parsed[occurrenceKey]) setRating(parsed[occurrenceKey])
      }
      const savedNotes = window.localStorage.getItem('academic-dashboard-session-notes')
      if (savedNotes) {
        const parsed = JSON.parse(savedNotes)
        if (parsed[occurrenceKey]) setNote(parsed[occurrenceKey])
      }
    } catch (e) {}
  }, [occurrenceKey])

  const saveRating = (val: number) => {
    setRating(val)
    try {
      const saved = window.localStorage.getItem('academic-dashboard-session-ratings')
      const parsed = saved ? JSON.parse(saved) : {}
      parsed[occurrenceKey] = val
      window.localStorage.setItem('academic-dashboard-session-ratings', JSON.stringify(parsed))
      window.dispatchEvent(new Event('academic-dashboard-tools-changed'))
    } catch (e) {}
  }

  const saveNote = (val: string) => {
    setNote(val)
    try {
      const saved = window.localStorage.getItem('academic-dashboard-session-notes')
      const parsed = saved ? JSON.parse(saved) : {}
      parsed[occurrenceKey] = val
      window.localStorage.setItem('academic-dashboard-session-notes', JSON.stringify(parsed))
      window.dispatchEvent(new Event('academic-dashboard-tools-changed'))
    } catch (e) {}
  }

  return (
    <motion.section variants={riseItem} className="mt-5 space-y-3">
      <SectionHeading icon={BookOpen}>Session Notes & Rating</SectionHeading>
      <div className="rounded-2xl border border-[color:var(--c-border)] bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">Class Understanding:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => saveRating(star)}
                className="text-lg transition hover:scale-110 active:scale-95"
              >
                {star <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Takeaways / Reminders:</label>
          <textarea
            value={note}
            onChange={(e) => saveNote(e.target.value)}
            placeholder="Write key takeaways, topics to review, or homework..."
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>
    </motion.section>
  )
}
