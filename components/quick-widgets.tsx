'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BellRing,
  CalendarCheck2,
  CalendarPlus,
  Check,
  CircleX,
  Clock,
  ExternalLink,
  FileText,
  ListTodo,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  allCourseOccurrences,
  ATTENDANCE_CHANGED_EVENT,
  COURSE_ORDER,
  courseOccurrences,
  EXCLUDED_COURSES_CHANGED_EVENT,
  getAttendanceLog,
  getAttendanceMetrics,
  getExcludedCourses,
  getLockedGroup,
  LOCKED_GROUP_CHANGED_EVENT,
  saveAttendanceLog,
  timetable,
  type AttendanceStatus,
  type CourseId,
  type GroupKey,
} from '@/lib/timetable'
import {
  getScheduleOverrides,
  SCHEDULE_OVERRIDES_CHANGED,
  type ScheduleOverride,
} from '@/lib/schedule-overrides'
import { SessionManagerDialog } from '@/components/session-manager-dialog'
import { ClassReschedulerDialog } from '@/components/class-rescheduler-dialog'
import { cn } from '@/lib/utils'
import { Lock } from 'lucide-react'

export function QuickWidgets({ group }: { group: GroupKey }) {
  const [courseId, setCourseId] = useState<Exclude<CourseId, 'clubs'>>(
    COURSE_ORDER[0] as Exclude<CourseId, 'clubs'>,
  )
  const [userHasSelectedCourse, setUserHasSelectedCourse] = useState(false)
  const [log, setLog] = useState<Record<string, AttendanceStatus>>({})
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [now, setNow] = useState<Date | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported')
  const [excluded, setExcluded] = useState<Exclude<CourseId, 'clubs'>[]>([])
  const [lockedGroup, setLockedGroup] = useState<GroupKey | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [reschedulerOpen, setReschedulerOpen] = useState(false)
  const sentAlerts = useRef(new Set<string>())

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if ('Notification' in window) setNotificationPermission(Notification.permission)
    const updateLog = () => setLog(getAttendanceLog())
    const updateOverrides = () => setOverrides(getScheduleOverrides())
    const updateEx = () => setExcluded(getExcludedCourses())
    const updateLg = () => setLockedGroup(getLockedGroup())
    updateLog()
    updateOverrides()
    updateEx()
    updateLg()

    window.addEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
    window.addEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
    window.addEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
    return () => {
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
      window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
      window.removeEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
      window.removeEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
    }
  }, [])

  const effectiveGroup = lockedGroup ?? group
  const isViewingOtherGroup = lockedGroup && group !== lockedGroup

  // Reset user course choice when switching groups so auto-selection re-evaluates for the new group
  useEffect(() => {
    setUserHasSelectedCourse(false)
  }, [effectiveGroup])

  // Context-aware default course selection on load or group change
  useEffect(() => {
    if (userHasSelectedCourse || !now) return
    const allOccs = allCourseOccurrences(effectiveGroup, overrides, excluded)
    const todayMsVal = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    const nowMin = now.getHours() * 60 + now.getMinutes()

    // 1. Class live right now
    const live = allOccs.find(
      (o) => o.ms === todayMsVal && o.startMin <= nowMin && o.endMin > nowMin,
    )
    if (live) {
      setCourseId(live.courseId)
      return
    }

    // 2. Unlogged completed class awaiting attendance
    const unlogged = allOccs.find(
      (o) =>
        (o.ms < todayMsVal || (o.ms === todayMsVal && o.endMin <= nowMin)) &&
        !log[o.key],
    )
    if (unlogged) {
      setCourseId(unlogged.courseId)
      return
    }

    // 3. Next upcoming class overall (today or next class day)
    const nextUpcoming = allOccs.find(
      (o) => o.ms > todayMsVal || (o.ms === todayMsVal && o.startMin > nowMin),
    )
    if (nextUpcoming) {
      setCourseId(nextUpcoming.courseId)
      return
    }
  }, [now, effectiveGroup, overrides, excluded, log, userHasSelectedCourse])

  const autoCourseReason = useMemo(() => {
    if (!now) return null
    const allOccs = allCourseOccurrences(effectiveGroup, overrides, excluded)
    const todayMsVal = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const live = allOccs.find(
      (o) => o.ms === todayMsVal && o.startMin <= nowMin && o.endMin > nowMin,
    )
    if (live && live.courseId === courseId) return 'Live now'

    const unlogged = allOccs.find(
      (o) =>
        (o.ms < todayMsVal || (o.ms === todayMsVal && o.endMin <= nowMin)) &&
        !log[o.key],
    )
    if (unlogged && unlogged.courseId === courseId) return 'Pending log'

    const nextUpcoming = allOccs.find(
      (o) => o.ms > todayMsVal || (o.ms === todayMsVal && o.startMin > nowMin),
    )
    if (nextUpcoming && nextUpcoming.courseId === courseId) return 'Next class'

    return null
  }, [now, effectiveGroup, overrides, excluded, log, courseId])

  const metrics = useMemo(
    () => getAttendanceMetrics(effectiveGroup, courseId, log, overrides, now ?? new Date(), excluded),
    [courseId, effectiveGroup, log, overrides, now, excluded],
  )

  const occurrences = useMemo(
    () => courseOccurrences(effectiveGroup, courseId, overrides),
    [courseId, effectiveGroup, overrides],
  )

  const todayMs = now
    ? Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    : null
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0

  const completed = occurrences.filter(
    (occurrence) =>
      todayMs !== null &&
      (occurrence.ms < todayMs ||
        (occurrence.ms === todayMs && occurrence.endMin <= nowMinutes)),
  )

  const pending = completed.filter((occurrence) => !log[occurrence.key])
  const attended = metrics.attended
  const alreadyMissed = metrics.alreadyMissed
  const unloggedCount = metrics.unlogged

  const current = occurrences.find(
    (occurrence) =>
      occurrence.ms === todayMs &&
      occurrence.startMin <= nowMinutes &&
      occurrence.endMin > nowMinutes,
  )

  const prompt = pending[pending.length - 1]

  const requiredFor80 = metrics.requiredFor80
  const maxAllowedMisses = metrics.maxAllowedMisses
  const remainingCanMiss = metrics.canStillMiss

  useEffect(() => {
    if (notificationPermission !== 'granted' || todayMs === null) return
    for (const occurrence of occurrences.filter((item) => item.ms === todayMs)) {
      const startKey = `${occurrence.key}:start`
      const endKey = `${occurrence.key}:end`
      if (
        nowMinutes >= occurrence.startMin &&
        nowMinutes < occurrence.startMin + 1 &&
        !sentAlerts.current.has(startKey)
      ) {
        new Notification(`${occurrence.code} is starting`, {
          body: 'Your session has started. Attendance can be logged when it finishes.',
        })
        sentAlerts.current.add(startKey)
      }
      if (
        nowMinutes >= occurrence.endMin &&
        nowMinutes < occurrence.endMin + 1 &&
        !sentAlerts.current.has(endKey)
      ) {
        new Notification(`${occurrence.code} session ended`, {
          body: 'Log your attendance now.',
        })
        sentAlerts.current.add(endKey)
      }
    }
  }, [notificationPermission, nowMinutes, occurrences, todayMs])

  const updateStatus = (status: AttendanceStatus) => {
    if (!prompt) return
    const next = { ...log, [prompt.key]: status }
    setLog(next)
    saveAttendanceLog(next)
  }

  const enableNotifications = async () => {
    if (!('Notification' in window)) return
    setNotificationPermission(await Notification.requestPermission())
  }

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-label="Quick course widgets"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Quick widgets
            </h2>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold',
                lockedGroup
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-muted text-muted-foreground',
              )}
              title={lockedGroup ? `Attendance locked to Group ${effectiveGroup}` : `Tracking Group ${effectiveGroup}`}
            >
              {lockedGroup && <Lock className="size-3" />}
              Group {effectiveGroup} {lockedGroup ? '(Locked)' : ''}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Session attendance follows real Group {effectiveGroup} timetable slots.
            {isViewingOtherGroup && (
              <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
                (Currently inspecting Group {group} timetable view)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {autoCourseReason && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-2 text-xs font-bold text-primary"
              title={`Contextually auto-selected because: ${autoCourseReason}`}
            >
              <Sparkles className="size-3.5 text-primary" />
              {autoCourseReason}
            </span>
          )}

          <select
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value as Exclude<CourseId, 'clubs'>)
              setUserHasSelectedCourse(true)
            }}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:flex-none"
          >
            {COURSE_ORDER.map((id) => (
              <option key={id} value={id}>
                {timetable.courses[id].code}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setReschedulerOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition"
          >
            <CalendarPlus className="size-4 text-primary" />
            <span className="hidden sm:inline">Reschedule</span>
          </button>

          <button
            type="button"
            onClick={enableNotifications}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary"
          >
            {notificationPermission === 'granted' ? (
              <BellRing className="size-4 text-primary" />
            ) : (
              <Bell className="size-4" />
            )}
            <span className="hidden sm:inline">
              {notificationPermission === 'granted' ? 'Alerts on' : 'Enable alerts'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Session Attendance & Manager Widget */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-muted/30 p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarCheck2 className="size-4 text-primary" /> Session attendance
              </div>
              <button
                type="button"
                onClick={() => setManagerOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ListTodo className="size-3.5" />
                Session manager
                {unloggedCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {unloggedCount}
                  </span>
                )}
              </button>
            </div>

            {prompt ? (
              <>
                <p className="mt-2.5 text-xs text-muted-foreground">
                  <strong className="text-foreground">{prompt.code}</strong> ended — log it now:
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => updateStatus('present')}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:brightness-95"
                  >
                    <Check className="size-3.5" /> Present
                  </button>
                  <button
                    onClick={() => updateStatus('missed')}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-destructive/50 hover:text-destructive"
                  >
                    <CircleX className="size-3.5" /> Missed
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-2.5 text-xs text-muted-foreground">
                {current
                  ? `${current.code} is live. We'll prompt you when it finishes.`
                  : 'No completed session awaiting instant log.'}
              </p>
            )}
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{attended}</strong> present ·{' '}
                <strong className="text-foreground">{alreadyMissed}</strong> missed
              </span>
              {unloggedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setManagerOpen(true)}
                  className="font-medium text-amber-600 hover:underline dark:text-amber-400"
                >
                  {unloggedCount} unlogged
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 80% Attendance Allowance Widget */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-muted/30 p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-4 text-primary" /> 80% attendance allowance
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  alreadyMissed > maxAllowedMisses
                    ? 'bg-destructive/15 text-destructive'
                    : remainingCanMiss === 0
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                )}
              >
                {alreadyMissed > maxAllowedMisses
                  ? 'Below 80%'
                  : remainingCanMiss === 0
                    ? '0 misses left'
                    : 'On track'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-card p-2.5 border border-border/60">
                <p className="text-[11px] font-medium text-muted-foreground">Already missed</p>
                <p className="mt-0.5 text-xl font-bold text-foreground tabular-nums">
                  {alreadyMissed}{' '}
                  <span className="text-xs font-normal text-muted-foreground">class{alreadyMissed === 1 ? '' : 'es'}</span>
                </p>
              </div>

              <div className="rounded-lg bg-card p-2.5 border border-border/60">
                <p className="text-[11px] font-medium text-muted-foreground">Can still miss</p>
                <p
                  className={cn(
                    'mt-0.5 text-xl font-bold tabular-nums',
                    remainingCanMiss === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-primary',
                  )}
                >
                  {remainingCanMiss}{' '}
                  <span className="text-xs font-normal text-muted-foreground">class{remainingCanMiss === 1 ? '' : 'es'}</span>
                </p>
              </div>
            </div>

            {/* Visual Attendance Progress Bar */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                <span>Missed allowance used</span>
                <span>
                  {alreadyMissed} / {maxAllowedMisses} ({maxAllowedMisses > 0 ? Math.min(100, Math.round((alreadyMissed / maxAllowedMisses) * 100)) : 0}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    alreadyMissed > maxAllowedMisses
                      ? 'bg-destructive'
                      : remainingCanMiss === 0
                        ? 'bg-amber-500'
                        : 'bg-emerald-500',
                  )}
                  style={{
                    width: `${maxAllowedMisses > 0 ? Math.min(100, Math.round((alreadyMissed / maxAllowedMisses) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Max allowed misses: <strong className="text-foreground">{maxAllowedMisses}</strong> · Needs{' '}
            <strong className="text-foreground">{requiredFor80}</strong> of {occurrences.length} planned{' '}
            {courseId === 'mern' ? 'sessions + labs' : 'sessions'}.
          </p>

          {/* Threshold Crossed Meme & Form Alert */}
          {alreadyMissed > maxAllowedMisses && (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3.5 text-destructive">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="size-4 animate-bounce text-destructive" />
                  Emundhi Le... Inka Paduko 😴
                </span>
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  Threshold Crossed
                </span>
              </div>

              {/* Tenor Meme Embed */}
              <div className="overflow-hidden rounded-xl border border-destructive/20 bg-background/80 shadow-xs">
                <iframe
                  src="https://tenor.com/embed/21376410"
                  width="100%"
                  height="180"
                  frameBorder="0"
                  className="w-full rounded-xl"
                  allowFullScreen
                  title="Emundhi Le Meme"
                />
              </div>

              {/* Google Form Link */}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSehkGVzY57bYg4gFMU912d1pRlajHUJtnsuy9gPLHP0UDZh4Q/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground shadow-sm transition hover:brightness-110"
              >
                <FileText className="size-4" />
                Submit Attendance Exemption / Appeal Form
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      <SessionManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        group={effectiveGroup}
      />

      <ClassReschedulerDialog
        open={reschedulerOpen}
        onOpenChange={setReschedulerOpen}
        group={effectiveGroup}
      />
    </section>
  )
}
