'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  Check,
  CheckCircle2,
  CircleX,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  History,
  RotateCcw,
  Search,
  Sparkles,
  Lock,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  allCourseOccurrences,
  ATTENDANCE_CHANGED_EVENT,
  courseClass,
  COURSE_ORDER,
  formatMinutes,
  fullDateLabel,
  getAttendanceLog,
  getAttendanceMetrics,
  getLockedGroup,
  LOCKED_GROUP_CHANGED_EVENT,
  saveAttendanceLog,
  timetable,
  type AttendanceStatus,
  type CourseId,
  type ExtendedOccurrence,
  type GroupKey,
} from '@/lib/timetable'
import {
  getScheduleOverrides,
  SCHEDULE_OVERRIDES_CHANGED,
  type ScheduleOverride,
} from '@/lib/schedule-overrides'
import { riseItem, spring, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface SessionManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: GroupKey
}

type TabFilter = 'unlogged' | 'present' | 'missed' | 'all'

export function SessionManagerDialog({
  open,
  onOpenChange,
  group,
}: SessionManagerDialogProps) {
  const [filterTab, setFilterTab] = useState<TabFilter>('unlogged')
  const [selectedCourse, setSelectedCourse] = useState<CourseId | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [log, setLog] = useState<Record<string, AttendanceStatus>>({})
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [lockedGroup, setLockedGroup] = useState<GroupKey | null>(null)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const updateLog = () => setLog(getAttendanceLog())
    const updateOverrides = () => setOverrides(getScheduleOverrides())
    const updateLg = () => setLockedGroup(getLockedGroup())
    updateLog()
    updateOverrides()
    updateLg()

    window.addEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
    window.addEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
    return () => {
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
      window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
      window.removeEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
    }
  }, [])

  const metrics = useMemo(
    () => getAttendanceMetrics(group, selectedCourse, log, overrides, now ?? new Date()),
    [group, selectedCourse, log, overrides, now],
  )

  const occurrences = useMemo(
    () => allCourseOccurrences(group, overrides),
    [group, overrides],
  )

  const todayMs = now ? Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) : null
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0

  // Completed sessions prior to or equal to current time
  const completedOccurrences = useMemo(() => {
    if (todayMs === null) return []
    return occurrences.filter(
      (occ) =>
        occ.ms < todayMs || (occ.ms === todayMs && occ.endMin <= nowMinutes),
    )
  }, [occurrences, todayMs, nowMinutes])

  // Filtered by course and search query
  const searchedOccurrences = useMemo(() => {
    return completedOccurrences.filter((occ) => {
      if (selectedCourse !== 'all' && occ.courseId !== selectedCourse) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const dateStr = fullDateLabel(occ.ms).toLowerCase()
      return (
        occ.code.toLowerCase().includes(q) ||
        occ.courseName.toLowerCase().includes(q) ||
        dateStr.includes(q)
      )
    })
  }, [completedOccurrences, selectedCourse, searchQuery])

  // Counts across course selection
  const courseFilteredCompleted = useMemo(() => {
    if (selectedCourse === 'all') return completedOccurrences
    return completedOccurrences.filter((occ) => occ.courseId === selectedCourse)
  }, [completedOccurrences, selectedCourse])

  const totalAttendedCount = metrics.attended
  const totalMissedCount = metrics.alreadyMissed
  const totalUnloggedCount = metrics.unlogged
  const attendancePercentage = metrics.attendancePercentage

  // Tab filtered list
  const displayedOccurrences = useMemo(() => {
    return searchedOccurrences.filter((occ) => {
      const st = log[occ.key] ?? null
      if (filterTab === 'unlogged') return st === null
      if (filterTab === 'present') return st === 'present'
      if (filterTab === 'missed') return st === 'missed'
      return true // 'all'
    })
  }, [searchedOccurrences, log, filterTab])

  const updateSingleStatus = (key: string, status: AttendanceStatus | null) => {
    const next = { ...log }
    if (status === null) {
      delete next[key]
    } else {
      next[key] = status
    }
    setLog(next)
    saveAttendanceLog(next)
  }

  const markAllDisplayed = (status: AttendanceStatus) => {
    const next = { ...log }
    for (const occ of displayedOccurrences) {
      next[occ.key] = status
    }
    setLog(next)
    saveAttendanceLog(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-h-[88vh] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 rounded-2xl border border-border bg-popover shadow-2xl">
        {/* Sticky Compact Header */}
        <DialogHeader className="shrink-0 border-b border-border bg-card p-4 sm:p-5 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2.5 pr-6">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock className="size-4.5" />
              </span>
              <div>
                <DialogTitle className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg flex items-center gap-1.5">
                  Session Attendance Manager
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {lockedGroup === group && <Lock className="size-3" />}
                    Group {group}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground hidden sm:block">
                  Track completed Group {group} sessions & maintain your 80% attendance allowance
                </DialogDescription>
              </div>
            </div>

            {totalUnloggedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                {totalUnloggedCount} unlogged
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                All logged
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Body Viewport for Mobile */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 touch-pan-y">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-2 text-center rounded-xl border border-border/80 bg-muted/30 p-2.5 sm:grid-cols-4">
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {totalAttendedCount}
              </p>
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Attended
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {totalMissedCount}
              </p>
              <p className="text-[10px] font-medium text-destructive">Missed</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {totalUnloggedCount}
              </p>
              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Unlogged
              </p>
            </div>
            <div>
              <p
                className={cn(
                  'text-sm font-bold tabular-nums',
                  attendancePercentage >= 80 ? 'text-primary' : 'text-destructive',
                )}
              >
                {attendancePercentage}%
              </p>
              <p className="text-[10px] font-medium text-muted-foreground">Attendance</p>
            </div>
          </div>

          {/* Threshold Crossed Meme & Appeal Form Alert */}
          {metrics.isBelow80 && (
            <div className="flex flex-col gap-2.5 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-3 text-destructive">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="size-4 animate-bounce text-destructive shrink-0" />
                  Below 80% · Emundhi Le... Inka Paduko 😴
                </span>
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  Threshold Crossed
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-destructive/20 bg-background/80 shadow-xs">
                <iframe
                  src="https://tenor.com/embed/21376410"
                  width="100%"
                  height="140"
                  frameBorder="0"
                  className="w-full rounded-xl"
                  allowFullScreen
                  title="Emundhi Le Meme"
                />
              </div>

              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSehkGVzY57bYg4gFMU912d1pRlajHUJtnsuy9gPLHP0UDZh4Q/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground shadow-sm transition hover:brightness-110 active:scale-95 text-center"
              >
                <FileText className="size-4 shrink-0" />
                <span>Submit Exemption / Appeal Form</span>
                <ExternalLink className="size-3.5 shrink-0" />
              </a>
            </div>
          )}

          {/* Filter Bar & Search */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Tabs */}
            <div
              role="tablist"
              className="scrollbar-none flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 touch-pan-x"
            >
              {[
                { id: 'unlogged', label: 'Unlogged', count: totalUnloggedCount },
                { id: 'present', label: 'Present', count: totalAttendedCount },
                { id: 'missed', label: 'Missed', count: totalMissedCount },
                { id: 'all', label: 'All', count: courseFilteredCompleted.length },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filterTab === id}
                  onClick={() => setFilterTab(id as TabFilter)}
                  className={cn(
                    'relative rounded-lg px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap active:scale-95',
                    filterTab === id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {filterTab === id && (
                    <motion.span
                      layoutId="manager-tab-pill"
                      transition={spring}
                      className="absolute inset-0 rounded-lg bg-card shadow-sm"
                    />
                  )}
                  <span className="relative flex items-center gap-1">
                    {label}
                    <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums">
                      {count}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* Course Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value as CourseId | 'all')}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-36"
              >
                <option value="all">All courses</option>
                {COURSE_ORDER.filter((id) => id !== 'clubs').map((id) => (
                  <option key={id} value={id}>
                    {timetable.courses[id]?.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by course, topic, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Action Header for Bulk Logging */}
          {filterTab === 'unlogged' && displayedOccurrences.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {displayedOccurrences.length} session{displayedOccurrences.length === 1 ? '' : 's'} awaiting log
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => markAllDisplayed('present')}
                  className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95 sm:flex-none"
                >
                  <Check className="size-3.5" /> Mark all present
                </button>
                <button
                  type="button"
                  onClick={() => markAllDisplayed('missed')}
                  className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:border-destructive/50 hover:text-destructive transition active:scale-95 sm:flex-none"
                >
                  <CircleX className="size-3.5 text-destructive" /> Mark all missed
                </button>
              </div>
            </div>
          )}

          {/* Session Cards List */}
          {displayedOccurrences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-6" />
              </span>
              <h3 className="mt-3 font-display text-sm font-bold text-foreground">
                No sessions found
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {filterTab === 'unlogged'
                  ? 'All completed classes for this selection have been recorded!'
                  : 'No class occurrences match your active filter or search query.'}
              </p>
            </div>
          ) : (
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-2.5"
            >
              {displayedOccurrences.map((occ) => (
                <SessionCard
                  key={occ.key}
                  occ={occ}
                  status={log[occ.key] ?? null}
                  onMarkPresent={() => updateSingleStatus(occ.key, 'present')}
                  onMarkMissed={() => updateSingleStatus(occ.key, 'missed')}
                  onClear={() => updateSingleStatus(occ.key, null)}
                />
              ))}
            </motion.ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SessionCard({
  occ,
  status,
  onMarkPresent,
  onMarkMissed,
  onClear,
}: {
  occ: ExtendedOccurrence
  status: AttendanceStatus | null
  onMarkPresent: () => void
  onMarkMissed: () => void
  onClear: () => void
}) {
  return (
    <motion.li
      variants={riseItem}
      className={cn(
        courseClass(occ.courseId),
        'relative flex flex-col justify-between gap-3 rounded-2xl border border-[color:var(--c-border)] bg-[color:var(--c-soft)]/50 p-4 transition sm:flex-row sm:items-center',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-[color:var(--c-solid)] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
            {occ.code}
          </span>
          {occ.isLab && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--c-border)] bg-background/70 px-2 py-0.5 text-xs font-medium text-[color:var(--c-text)]">
              <FlaskConical className="size-3" /> Lab
            </span>
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {fullDateLabel(occ.ms)}
          </span>
        </div>

        <p className="font-semibold text-sm leading-snug text-foreground">
          {occ.courseName}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5 opacity-70" />
            {formatMinutes(occ.startMin)} – {formatMinutes(occ.endMin)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onMarkPresent}
          className={cn(
            'inline-flex min-h-[38px] flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 sm:flex-none',
            status === 'present'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'border border-border bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          <Check className="size-3.5" /> Present
        </button>

        <button
          type="button"
          onClick={onMarkMissed}
          className={cn(
            'inline-flex min-h-[38px] flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 sm:flex-none',
            status === 'missed'
              ? 'bg-destructive text-destructive-foreground shadow-xs'
              : 'border border-border bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          <CircleX className="size-3.5" /> Missed
        </button>

        {status !== null && (
          <button
            type="button"
            onClick={onClear}
            title="Reset to unlogged"
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    </motion.li>
  )
}
