'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { ArrowUpRight, ClipboardCheck, Link2, Users, ListChecks, CheckSquare, Square, Plus, Minus, BookOpen, AlertCircle, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react'
import {
  courseClass,
  evaluationSchemes,
  facultiesFor,
  getCompletedSessionOverrides,
  getCourseAutoCompletion,
  getStudiedLog,
  pushRealtimeSync,
  setCompletedSessionOverride,
  setStudiedCount,
  COMPLETED_SESSION_OVERRIDE_CHANGED,
  STUDIED_LOG_CHANGED_EVENT,
  type Course,
} from '@/lib/timetable'
import { staggerContainer, riseItem } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function CourseDetail({ course }: { course: Course }) {
  const [completedSessions, setCompletedSessions] = useState<Record<string, boolean>>({})
  const [studiedLog, setStudiedLog] = useState<Record<string, number>>({})
  const [completedOverrides, setCompletedOverrides] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('academic-dashboard-syllabus-completed')
      if (saved) setCompletedSessions(JSON.parse(saved))
    } catch (e) {}

    const updateStudied = () => setStudiedLog(getStudiedLog())
    const updateCompleted = () => setCompletedOverrides(getCompletedSessionOverrides())
    updateStudied()
    updateCompleted()

    window.addEventListener(STUDIED_LOG_CHANGED_EVENT, updateStudied)
    window.addEventListener(COMPLETED_SESSION_OVERRIDE_CHANGED, updateCompleted)
    return () => {
      window.removeEventListener(STUDIED_LOG_CHANGED_EVENT, updateStudied)
      window.removeEventListener(COMPLETED_SESSION_OVERRIDE_CHANGED, updateCompleted)
    }
  }, [])

  const toggleSessionCompleted = (index: number) => {
    const key = `${course.id}-${index}`
    const next = { ...completedSessions, [key]: !completedSessions[key] }
    setCompletedSessions(next)
    try {
      window.localStorage.setItem('academic-dashboard-syllabus-completed', JSON.stringify(next))
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('academic-dashboard-tools-changed'))
      pushRealtimeSync()
    }
  }

  const autoCompletion = getCourseAutoCompletion(course.id)
  const autoCompletedCount = autoCompletion.held
  const totalCourseSessions = course.sessions.length || autoCompletion.total
  const autoProgressPercent = totalCourseSessions ? Math.round((autoCompletedCount / totalCourseSessions) * 100) : 0
  const isManuallyEdited = completedOverrides[course.id] !== undefined

  const studiedCount = studiedLog[course.id] ?? 0
  const backlogCount = Math.max(0, autoCompletedCount - studiedCount)

  const handleCompletedChange = (delta: number) => {
    const next = Math.max(0, autoCompletedCount + delta)
    setCompletedSessionOverride(course.id, next)
  }

  const handleResetCompleted = () => {
    const current = getCompletedSessionOverrides()
    delete current[course.id]
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('academic-dashboard-completed-sessions-override', JSON.stringify(current))
      window.dispatchEvent(new Event(COMPLETED_SESSION_OVERRIDE_CHANGED))
      pushRealtimeSync()
    }
  }

  const handleStudiedChange = (delta: number) => {
    const next = Math.max(0, studiedCount + delta)
    setStudiedCount(course.id, next)
  }

  const schemes = evaluationSchemes(course)
  const faculties = facultiesFor(course.id)
  const totalWeight = schemes[0]?.items.reduce((sum, e) => {
    const n = Number.parseFloat(e.weightage)
    return Number.isFinite(n) ? sum + n : sum
  }, 0)

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={cn('flex flex-col', courseClass(course.id))}
    >
      {/* Header */}
      <motion.div
        variants={riseItem}
        className="rounded-2xl border border-[color:var(--c-border)] bg-[color:var(--c-soft)] p-5 space-y-4"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[color:var(--c-solid)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              {course.code}
            </span>
            <span className="text-xs font-medium text-[color:var(--c-text)]/80">
              {totalCourseSessions} sessions planned
            </span>
          </div>
          <h2 className="mt-2 text-balance font-display text-2xl font-bold text-[color:var(--c-text)]">
            {course.name}
          </h2>
          {faculties.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-[color:var(--c-text)]/80">
              <Users className="size-4" />
              {faculties.join(', ')}
            </p>
          )}
        </div>

        {/* 1. Editable Session Progress */}
        <div className="pt-3 border-t border-[color:var(--c-border)]/40 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[color:var(--c-text)]">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="size-3.5" /> Sessions Completed
              {isManuallyEdited && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  Custom
                </span>
              )}
            </span>
            <span>{autoCompletedCount} / {totalCourseSessions} ({autoProgressPercent}%)</span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[color:var(--c-solid)] transition-all duration-300"
              style={{ width: `${autoProgressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-background/60 p-2 border border-[color:var(--c-border)]/30 text-xs">
            <span className="text-muted-foreground font-medium text-[11px]">
              {isManuallyEdited ? 'User overridden progress' : 'Live schedule auto-tracked'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {isManuallyEdited && (
                <button
                  type="button"
                  onClick={handleResetCompleted}
                  className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  title="Reset to live schedule count"
                >
                  <RotateCcw className="size-3" /> Auto
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCompletedChange(-1)}
                disabled={autoCompletedCount <= 0}
                className="inline-flex size-6 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-xs transition hover:bg-muted disabled:opacity-40 active:scale-95"
                title="Decrease completed session count"
              >
                <Minus className="size-3" />
              </button>
              <span className="min-w-5 text-center text-xs font-bold tabular-nums text-foreground">
                {autoCompletedCount}
              </span>
              <button
                type="button"
                onClick={() => handleCompletedChange(1)}
                className="inline-flex size-6 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-xs transition hover:bg-muted active:scale-95"
                title="Increase completed session count"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Student Self-Study Progress & Backlog Tracker */}
        <div className="pt-3 border-t border-[color:var(--c-border)]/40 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--c-text)]">
              <BookOpen className="size-4" />
              <span>Studied Progress & Self-Study Backlog</span>
            </div>
            {backlogCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                <AlertCircle className="size-3" />
                -{backlogCount} Session{backlogCount === 1 ? '' : 's'} Backlog
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3" />
                Up to Date! 🎉
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-background/60 p-2.5 border border-[color:var(--c-border)]/30">
            <div className="text-xs">
              <p className="font-semibold text-foreground">
                {studiedCount} of {autoCompletedCount} held sessions studied
              </p>
              <p className="text-[11px] text-muted-foreground">
                {backlogCount > 0 ? `${backlogCount} session(s) pending self-study review` : 'All completed sessions reviewed'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleStudiedChange(-1)}
                disabled={studiedCount <= 0}
                className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-xs transition hover:bg-muted disabled:opacity-40 active:scale-95"
                title="Decrease studied count"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="min-w-6 text-center text-xs font-bold tabular-nums text-foreground">
                {studiedCount}
              </span>
              <button
                type="button"
                onClick={() => handleStudiedChange(1)}
                className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-xs transition hover:bg-muted active:scale-95"
                title="Increase studied count"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Evaluation criteria */}
      {schemes.length > 0 && (
        <motion.section variants={riseItem} className="mt-6">
          <div className="flex items-center justify-between">
            <SectionHeading icon={ClipboardCheck}>Evaluation criteria</SectionHeading>
            {totalWeight ? (
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                Total {totalWeight}%
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {schemes.map((scheme, si) => (
              <div
                key={si}
                className="rounded-xl border border-border bg-card p-1.5"
              >
                <p className="px-2 py-1.5 text-xs font-semibold text-foreground">
                  {scheme.heading}
                </p>
                <div className="overflow-hidden rounded-lg">
                  {scheme.items.map((ev, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center justify-between gap-3 px-2 py-2',
                        i > 0 && 'border-t border-border',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {ev.component}
                        </p>
                        {ev.comments && (
                          <p className="truncate text-xs text-muted-foreground">
                            {ev.comments}
                          </p>
                        )}
                      </div>
                      {ev.weightage && (
                        <span className="shrink-0 rounded-md bg-[color:var(--c-soft)] px-2 py-0.5 text-xs font-bold tabular-nums text-[color:var(--c-text)]">
                          {ev.weightage}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Full syllabus */}
      <motion.section variants={riseItem} className="mt-6">
        <SectionHeading icon={ListChecks}>
          Complete syllabus · {course.sessions.length} sessions
        </SectionHeading>

        {course.sessions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            No structured syllabus is published for this activity.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {course.sessions.map((s, i) => {
              const isCompleted = completedSessions[`${course.id}-${i}`]
              return (
                <li
                  key={i}
                  className={cn(
                    "rounded-xl border p-3 transition hover:shadow-xs flex items-center justify-between gap-3",
                    isCompleted
                      ? "border-[color:var(--c-border)] bg-[color:var(--c-soft)]/20 opacity-90"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex gap-3 min-w-0 flex-1">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--c-soft)] text-xs font-bold text-[color:var(--c-text)]">
                      {s.number || i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-semibold leading-snug text-foreground", isCompleted && "line-through opacity-60")}>
                        {s.title}
                      </p>
                      {s.topics.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {s.topics.map((t, j) => (
                            <li
                              key={j}
                              className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                            >
                              <span
                                className="mt-1.5 size-1 shrink-0 rounded-full bg-[color:var(--c-solid)]"
                                aria-hidden
                              />
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                      {s.assignments && <AssignmentLink href={s.assignments} />}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSessionCompleted(i)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-[color:var(--c-soft)] hover:text-[color:var(--c-text)] active:scale-95"
                    title={isCompleted ? "Mark as Incomplete" : "Mark as Completed"}
                  >
                    {isCompleted ? (
                      <CheckSquare className="size-5 text-[color:var(--c-solid)]" />
                    ) : (
                      <Square className="size-5" />
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </motion.section>
    </motion.div>
  )
}

function AssignmentLink({ href }: { href: string }) {
  const isUrl = /^https?:\/\//.test(href)
  if (!isUrl) {
    return <p className="mt-2 text-xs text-muted-foreground">Assignment: {href}</p>
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--c-border)] bg-[color:var(--c-soft)]/50 px-2.5 py-1 text-xs font-medium text-[color:var(--c-text)] transition hover:brightness-95"
    >
      <Link2 className="size-3.5" />
      Assignment
      <ArrowUpRight className="size-3.5" />
    </a>
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
