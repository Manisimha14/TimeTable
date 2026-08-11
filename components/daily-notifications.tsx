'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  AlertTriangle,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  ListTodo,
  Sparkles,
  X,
} from 'lucide-react'
import {
  allCourseOccurrences,
  ATTENDANCE_CHANGED_EVENT,
  COURSE_ORDER,
  EXCLUDED_COURSES_CHANGED_EVENT,
  fullDateLabel,
  getAttendanceLog,
  getAttendanceMetrics,
  getExcludedCourses,
  getLockedGroup,
  LOCKED_GROUP_CHANGED_EVENT,
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
import { upcomingEvents } from '@/lib/academic-calendar'
import { cn } from '@/lib/utils'
import { Lock } from 'lucide-react'

interface DailyNotificationsProps {
  group: GroupKey
  onOpenSessionManager?: () => void
}

export function DailyNotifications({
  group,
  onOpenSessionManager,
}: DailyNotificationsProps) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<Record<string, AttendanceStatus>>({})
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [excluded, setExcluded] = useState<Exclude<CourseId, 'clubs'>[]>([])
  const [lockedGroup, setLockedGroup] = useState<GroupKey | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported')

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if ('Notification' in window) setPushPermission(Notification.permission)
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

  const todayMsVal = now ? Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) : 0
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0

  const occurrences = useMemo(
    () => allCourseOccurrences(group, overrides, excluded),
    [group, overrides, excluded],
  )

  const todayOccurrences = useMemo(
    () => occurrences.filter((o) => o.ms === todayMsVal),
    [occurrences, todayMsVal],
  )

  const liveSession = useMemo(
    () =>
      todayOccurrences.find((o) => o.startMin <= nowMin && o.endMin > nowMin),
    [todayOccurrences, nowMin],
  )

  const nextSession = useMemo(
    () =>
      todayOccurrences.find((o) => o.startMin > nowMin),
    [todayOccurrences, nowMin],
  )

  const unloggedSessions = useMemo(() => {
    return occurrences.filter(
      (o) =>
        (o.ms < todayMsVal || (o.ms === todayMsVal && o.endMin <= nowMin)) &&
        !log[o.key],
    )
  }, [occurrences, todayMsVal, nowMin, log])

  const upcomingCalEvents = useMemo(() => upcomingEvents(2, now ?? new Date()), [now])

  const allAssessedMetrics = useMemo(
    () => getAttendanceMetrics(group, 'all', log, overrides, now ?? new Date(), excluded),
    [group, log, overrides, now, excluded],
  )

  const urgentCount =
    (liveSession ? 1 : 0) +
    (unloggedSessions.length > 0 ? 1 : 0) +
    (allAssessedMetrics.isBelow80 ? 1 : 0)

  const requestPush = async () => {
    if (!('Notification' in window)) return
    setPushPermission(await Notification.requestPermission())
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-xs transition hover:bg-muted"
        aria-label="Daily Notifications"
      >
        <Bell className="size-4.5" />
        {urgentCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
            {urgentCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
              onClick={() => setOpen(false)}
            />

            {/* Notification Card Popover */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              className="fixed inset-x-3 top-16 z-50 max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-96 sm:max-h-none"
            >
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Daily Context Assistant
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
                {/* 1. Live Session Notification */}
                {liveSession && (
                  <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-primary">
                      <Flame className="size-4 animate-bounce" /> Live Session Now
                    </div>
                    <p className="mt-1 font-semibold text-foreground">
                      {liveSession.code}: {liveSession.courseName}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      Ends at {liveSession.endMin ? `${Math.floor(liveSession.endMin / 60)}:${(liveSession.endMin % 60).toString().padStart(2, '0')}` : ''}
                    </p>
                  </div>
                )}

                {/* 2. Today's Overview */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-primary" /> Today&apos;s Schedule
                    </span>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      {lockedGroup === group && <Lock className="size-2.5 text-primary" />}
                      Group {group}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {todayOccurrences.length > 0 ? (
                      <>
                        You have <strong>{todayOccurrences.length} session{todayOccurrences.length === 1 ? '' : 's'}</strong> today ({todayOccurrences.map((o) => o.code).join(', ')}).
                      </>
                    ) : (
                      'No classes scheduled for today. Enjoy your day!'
                    )}
                  </p>
                </div>

                {/* 3. Next Session Alert */}
                {nextSession && !liveSession && (
                  <div className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Clock className="size-3.5 text-primary" /> Next Up Today
                    </div>
                    <p className="font-semibold text-foreground">
                      {nextSession.code} · {nextSession.courseName}
                    </p>
                  </div>
                )}

                {/* 4. Unlogged Sessions Alert */}
                {unloggedSessions.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="size-3.5" /> Pending Attendance Logs
                      </span>
                      {onOpenSessionManager && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false)
                            onOpenSessionManager()
                          }}
                          className="font-bold text-amber-700 underline dark:text-amber-300 hover:brightness-110"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {unloggedSessions.length} completed session{unloggedSessions.length === 1 ? '' : 's'} awaiting attendance mark.
                    </p>
                  </div>
                )}

                {/* 5. Attendance Floor Alert */}
                {allAssessedMetrics.isBelow80 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" /> Attendance Below 80% · Emundhi Le 😴
                    </p>
                    <p className="opacity-90">
                      Your overall attendance is currently {allAssessedMetrics.attendancePercentage}%. Missed {allAssessedMetrics.alreadyMissed} of {allAssessedMetrics.maxAllowedMisses} allowed misses.
                    </p>
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLSehkGVzY57bYg4gFMU912d1pRlajHUJtnsuy9gPLHP0UDZh4Q/viewform"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-destructive px-2.5 py-1.5 text-[11px] font-bold text-destructive-foreground transition hover:brightness-110"
                    >
                      <FileText className="size-3.5" />
                      Attendance Appeal / Exemption Form
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}

                {/* 6. Upcoming Calendar Events */}
                {upcomingCalEvents.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                    <p className="font-bold text-foreground">Academic Events</p>
                    {upcomingCalEvents.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between text-muted-foreground">
                        <span>{ev.label}</span>
                        <span className="font-semibold text-foreground">{ev.daysUntil === 0 ? 'Today' : `in ${ev.daysUntil}d`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Push Toggle */}
              <div className="border-t border-border bg-muted/40 p-3 text-center">
                <button
                  type="button"
                  onClick={requestPush}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  {pushPermission === 'granted' ? (
                    <>
                      <BellRing className="size-3.5 text-primary" /> Push Alerts Active
                    </>
                  ) : (
                    <>
                      <Bell className="size-3.5" /> Enable Desktop Push Alerts
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
