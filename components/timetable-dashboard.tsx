'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarRange, CalendarDays, CalendarClock, GraduationCap, Flag, Wrench, CalendarPlus, Lock, Unlock } from 'lucide-react'
import {
  currentWeekIndex,
  EXCLUDED_COURSES_CHANGED_EVENT,
  getExcludedCourses,
  getLockedGroup,
  LOCKED_GROUP_CHANGED_EVENT,
  loadSyncFromUrl,
  pullRealtimeSync,
  REALTIME_SYNC_CHANGED_EVENT,
  saveLockedGroup,
  timetable,
  todayDayIndex,
  weekByIndex,
  type CourseId,
  type GroupKey,
  type TimetableEvent,
} from '@/lib/timetable'
import { spring, tabPanel, weekSlide } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { CourseLegend } from '@/components/course-legend'
import { WeekSwitcher } from '@/components/week-switcher'
import { WeekCalendar } from '@/components/week-calendar'
import { DayAgenda } from '@/components/day-agenda'
import { EventDetailDialog } from '@/components/event-detail-dialog'
import { ClassReschedulerDialog } from '@/components/class-rescheduler-dialog'
import { SessionManagerDialog } from '@/components/session-manager-dialog'
import { DailyNotifications } from '@/components/daily-notifications'
import { CoursesTab } from '@/components/courses-tab'
import { AcademicCalendarView } from '@/components/academic-calendar-view'
import { KeyDates } from '@/components/key-dates'
import { PersonalDeadlinesTab } from '@/components/personal-deadlines-tab'
import { ToolsTab } from '@/components/tools-tab'
import { QuickWidgets } from '@/components/quick-widgets'

import { blockedInfo, isoToMs } from '@/lib/academic-calendar'
import {
  getScheduleOverrides,
  SCHEDULE_OVERRIDES_CHANGED,
  type ScheduleOverride,
} from '@/lib/schedule-overrides'

const GROUPS: GroupKey[] = ['A', 'B', 'C']
type View = 'timetable' | 'calendar' | 'courses' | 'personal' | 'tools'

const VIEWS: { id: View; label: string; shortLabel?: string; icon: React.ElementType }[] = [
  { id: 'timetable', label: 'Timetable', shortLabel: 'Schedule', icon: CalendarDays },
  { id: 'calendar', label: 'Academic Calendar', shortLabel: 'Calendar', icon: CalendarClock },
  { id: 'courses', label: 'Courses', icon: GraduationCap },
  { id: 'personal', label: 'Personal deadlines', shortLabel: 'Deadlines', icon: Flag },
  { id: 'tools', label: 'Student tools', shortLabel: 'Tools', icon: Wrench },
]

export function TimetableDashboard() {
  const [view, setView] = useState<View>('timetable')
  const [group, setGroup] = useState<GroupKey>('A')
  const [lockedGroup, setLockedGroup] = useState<GroupKey | null>(null)
  const [excluded, setExcluded] = useState<Exclude<CourseId, 'clubs'>[]>([])
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [activeCourse, setActiveCourse] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<TimetableEvent | null>(null)
  const [courseFocus, setCourseFocus] = useState<string | null>(null)
  const [nowMinutes, setNowMinutes] = useState<number | null>(null)
  const [todayIdx, setTodayIdx] = useState<number>(-1)
  const [selectedDay, setSelectedDay] = useState<number>(0)
  const [weekIndex, setWeekIndex] = useState<number>(1)
  const [currentWeek, setCurrentWeek] = useState<number>(1)
  const [direction, setDirection] = useState<number>(0)
  const [reschedulerOpen, setReschedulerOpen] = useState(false)
  const [reschedulerInitialKey, setReschedulerInitialKey] = useState<string | null>(null)
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false)

  // Client-only clock & locked group / excluded courses / overrides loader
  useEffect(() => {
    loadSyncFromUrl()
    const autoSync = () => pullRealtimeSync()
    autoSync()
    const syncInterval = setInterval(autoSync, 2000)

    const lg = getLockedGroup()
    setLockedGroup(lg)
    if (lg) setGroup(lg)
    setExcluded(getExcludedCourses())
    setOverrides(getScheduleOverrides())

    const updateLg = () => setLockedGroup(getLockedGroup())
    const updateEx = () => setExcluded(getExcludedCourses())
    const updateOv = () => setOverrides(getScheduleOverrides())
    const updateSync = () => pullRealtimeSync()

    window.addEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
    window.addEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOv)
    window.addEventListener(REALTIME_SYNC_CHANGED_EVENT, updateSync)
    window.addEventListener('focus', autoSync)
    document.addEventListener('visibilitychange', autoSync)

    const update = () => {
      const now = new Date()
      setNowMinutes(now.getHours() * 60 + now.getMinutes())
      const ti = todayDayIndex(now)
      setTodayIdx(ti)
      setSelectedDay((prev) => (prev === 0 && ti >= 0 ? ti : prev))
    }
    update()
    const cw = currentWeekIndex()
    setCurrentWeek(cw)
    setWeekIndex(cw)
    const id = setInterval(update, 60_000)
    return () => {
      clearInterval(id)
      clearInterval(syncInterval)
      window.removeEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
      window.removeEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
      window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOv)
      window.removeEventListener(REALTIME_SYNC_CHANGED_EVENT, updateSync)
      window.removeEventListener('focus', autoSync)
      document.removeEventListener('visibilitychange', autoSync)
    }
  }, [])

  const rawEvents = timetable.eventsByGroup[group] ?? []
  const events = useMemo(
    () => rawEvents.filter((e) => !e.courseId || !excluded.includes(e.courseId as Exclude<CourseId, 'clubs'>)),
    [rawEvents, excluded],
  )

  const isCurrentWeek = weekIndex === currentWeek
  const week = weekByIndex(weekIndex)

  // Dynamic class count and weekly hours calculation for the selected week (weekIndex)
  const weekStats = useMemo(() => {
    if (!week) return { classCount: 0, weeklyHours: 0 }

    const cancelKeys = new Set(
      overrides.filter((o) => o.type === 'cancel' || o.type === 'reschedule').map((o) => o.originalKey),
    )

    let count = 0
    let totalMinutes = 0

    // Standard events on non-blocked days in this week that aren't canceled/rescheduled
    for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
      const cell = week.days[dayIdx]
      if (!cell || !cell.inTerm) continue
      const blocked = blockedInfo(cell.ms)
      if (blocked.blocked) continue

      const dayEvs = events.filter((e) => e.dayIndex === dayIdx && e.type === 'class')
      for (const e of dayEvs) {
        const key = `${e.id}|${weekIndex}`
        if (cancelKeys.has(key)) continue
        count++
        totalMinutes += e.durationMin
      }
    }

    // Add extra / rescheduled classes for this week
    for (const ov of overrides) {
      if (ov.courseId && excluded.includes(ov.courseId)) continue
      const ms = isoToMs(ov.dateIso)
      if (blockedInfo(ms).blocked) continue
      const inWeek = week.days.some((d) => d.ms === ms)
      if (inWeek && (ov.type === 'reschedule' || ov.type === 'extra')) {
        count++
        totalMinutes += ov.endMin - ov.startMin
      }
    }

    return {
      classCount: count,
      weeklyHours: Math.round(totalMinutes / 60),
    }
  }, [week, events, weekIndex, overrides, excluded])

  const classCount = weekStats.classCount
  const weeklyHours = weekStats.weeklyHours

  const changeWeek = (index: number, dir: number) => {
    setDirection(dir)
    setWeekIndex(index)
  }

  const openCourse = (courseId: string) => {
    setCourseFocus(courseId)
    setView('courses')
  }

  const toggleLockGroup = (g: GroupKey, e: React.MouseEvent) => {
    e.stopPropagation()
    if (lockedGroup === g) {
      saveLockedGroup(null)
    } else {
      saveLockedGroup(g)
      setGroup(g)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-6 lg:py-10" suppressHydrationWarning>
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarRange className="size-4" />
              <span>{timetable.meta.batch}</span>
            </div>
            <h1 className="mt-1 text-balance font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
              {view === 'calendar'
                ? 'Academic Calendar'
                : view === 'courses'
                  ? `${timetable.meta.term} Courses`
                  : view === 'personal'
                    ? 'Personal deadlines'
                    : view === 'tools'
                      ? 'Student tools'
                  : `${timetable.meta.term} Weekly Timetable`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === 'calendar'
                ? '2026 – 2027 · All batches'
                : view === 'personal'
                  ? 'A focused space for your individual priorities'
                  : view === 'tools'
                    ? 'Plan smarter with your private study toolkit'
                : `${timetable.meta.period} · Monday–Saturday`}
            </p>
          </div>

          {/* Group switcher & Notifications */}
          <div className="flex items-center gap-2">
            <DailyNotifications
              group={lockedGroup ?? group}
              onOpenSessionManager={() => setSessionManagerOpen(true)}
            />
            <AnimatePresence mode="popLayout">
              {view === 'timetable' && (
                <motion.div
                  key="group-switcher"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={spring}
                  role="tablist"
                  aria-label="Select group"
                  className="inline-flex w-full rounded-xl border border-border bg-muted/50 p-1 sm:w-auto items-center"
                >
                  {GROUPS.map((g) => {
                    const isSelected = group === g
                    const isLocked = lockedGroup === g
                    return (
                      <button
                        key={g}
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => setGroup(g)}
                        className={cn(
                          'relative inline-flex items-center justify-center flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition sm:flex-none gap-1.5',
                          isSelected
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="group-pill"
                            transition={spring}
                            className="absolute inset-0 rounded-lg bg-card shadow-sm"
                          />
                        )}
                        <span className="relative flex items-center gap-1">
                          <span className="hidden sm:inline">Group </span>
                          {g}
                        </span>

                        {/* Lock / Unlock Toggle Button */}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => toggleLockGroup(g, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggleLockGroup(g, e as any)
                            }
                          }}
                          className={cn(
                            'relative z-10 rounded-md p-0.5 transition hover:bg-muted/80',
                            isLocked
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-foreground',
                          )}
                          title={
                            isLocked
                              ? `Group ${g} is locked as your primary group. Click to unlock.`
                              : `Lock Group ${g} for your personalized push notifications & timetable.`
                          }
                        >
                          {isLocked ? (
                            <Lock className="size-3.5 text-primary" />
                          ) : (
                            <Unlock className="size-3.5" />
                          )}
                        </span>
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Top-level view tabs */}
        <div
          role="tablist"
          aria-label="Select view"
          className="scrollbar-none mt-5 flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 touch-pan-x sm:inline-flex sm:w-auto"
        >
          {VIEWS.map(({ id, label, shortLabel, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                'relative inline-flex min-h-[40px] min-w-max flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition sm:flex-none sm:gap-2 sm:px-4 sm:text-sm active:scale-95',
                view === id
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {view === id && (
                <motion.span
                  layoutId="view-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                />
              )}
              <span className="relative flex items-center gap-1.5 sm:gap-2">
                <Icon className="size-4 shrink-0" />
                <span className={shortLabel ? 'hidden sm:inline' : undefined}>{label}</span>
                {shortLabel && <span className="sm:hidden">{shortLabel}</span>}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* View panels */}
      <AnimatePresence mode="wait">
        {view === 'timetable' && (
          <motion.div
            key="timetable"
            variants={tabPanel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* Key dates — quick glance at the next academic-calendar events */}
            <div className="mb-5">
              <KeyDates onOpenCalendar={() => setView('calendar')} />
            </div>

            <div className="mb-5">
              <QuickWidgets group={group} />
            </div>

            {/* Toolbar: legend + stats & rescheduler */}
            <div className="mb-4 flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
              <CourseLegend activeCourse={activeCourse} onToggle={setActiveCourse} group={group} />
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setReschedulerInitialKey(null)
                    setReschedulerOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition"
                >
                  <CalendarPlus className="size-3.5 text-primary" />
                  Class rescheduler
                </button>
                <span className="h-4 w-px bg-border" aria-hidden />
                <span>
                  <span className="font-semibold text-foreground">{classCount}</span> classes
                </span>
                <span className="h-4 w-px bg-border" aria-hidden />
                <span>
                  <span className="font-semibold text-foreground">~{weeklyHours}h</span> / week
                </span>
              </div>
            </div>

            {/* Week switcher */}
            <div className="mb-4">
              <WeekSwitcher
                weekIndex={weekIndex}
                currentWeek={currentWeek}
                onChange={changeWeek}
              />
            </div>

            {/* Calendar (desktop) */}
            <div className="hidden lg:block">
              <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                <motion.div
                  key={`${group}-${weekIndex}`}
                  custom={direction}
                  variants={weekSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <WeekCalendar
                    events={events}
                    activeCourse={activeCourse}
                    weekIndex={weekIndex}
                    isCurrentWeek={isCurrentWeek}
                    todayIndex={todayIdx}
                    nowMinutes={nowMinutes}
                    onSelect={setSelectedEvent}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Agenda (mobile / tablet) */}
            <div className="lg:hidden">
              <DayAgenda
                events={events}
                activeCourse={activeCourse}
                selectedDay={selectedDay}
                weekIndex={weekIndex}
                isCurrentWeek={isCurrentWeek}
                todayIndex={todayIdx}
                onSelectDay={setSelectedDay}
                onSelect={setSelectedEvent}
              />
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Showing {week?.label}. Tap any class to see the exact session taught that week.
            </p>
          </motion.div>
        )}

        {view === 'calendar' && (
          <motion.div
            key="calendar"
            variants={tabPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className="border-t border-border pt-6"
          >
            <AcademicCalendarView />
          </motion.div>
        )}

        {view === 'courses' && (
          <motion.div
            key="courses"
            variants={tabPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className="border-t border-border pt-6"
          >
            <CoursesTab key={courseFocus ?? 'default'} initialCourse={courseFocus} />
          </motion.div>
        )}

        {view === 'personal' && (
          <motion.div key="personal" variants={tabPanel} initial="hidden" animate="show" exit="exit" className="border-t border-border pt-6">
            <PersonalDeadlinesTab />
          </motion.div>
        )}

        {view === 'tools' && (
          <motion.div key="tools" variants={tabPanel} initial="hidden" animate="show" exit="exit" className="border-t border-border pt-6">
            <ToolsTab group={group} />
          </motion.div>
        )}
      </AnimatePresence>

      <EventDetailDialog
        event={selectedEvent}
        group={group}
        lockedGroup={lockedGroup}
        groupLabel={timetable.meta.groups[group]}
        weekIndex={weekIndex}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
        onViewCourse={openCourse}
        onOpenRescheduler={(eventKey) => {
          setReschedulerInitialKey(eventKey)
          setReschedulerOpen(true)
        }}
      />

      <ClassReschedulerDialog
        open={reschedulerOpen}
        onOpenChange={setReschedulerOpen}
        group={group}
        initialEventKey={reschedulerInitialKey}
      />

      <SessionManagerDialog
        open={sessionManagerOpen}
        onOpenChange={setSessionManagerOpen}
        group={group}
      />

      {/* Footer */}
      <footer className="mt-16 border-t border-border/60 pt-8 pb-12 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
          <p className="font-semibold text-foreground">
            Scaler School of Technology · SST 2029
          </p>
          <span className="hidden text-border sm:inline">•</span>
          <p className="flex items-center gap-1 font-medium text-foreground">
            Made with <span className="text-destructive font-bold animate-pulse">❤️</span> by Mani
          </p>
        </div>
      </footer>
    </div>
  )
}
