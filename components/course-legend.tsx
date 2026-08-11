'use client'

import { useEffect, useState } from 'react'
import { Check, FlaskConical } from 'lucide-react'
import {
  COURSE_ORDER,
  courseClass,
  EXCLUDED_COURSES_CHANGED_EVENT,
  getExcludedCourses,
  getLabBreakdown,
  saveExcludedCourses,
  timetable,
  type CourseId,
  type GroupKey,
} from '@/lib/timetable'
import {
  getScheduleOverrides,
  SCHEDULE_OVERRIDES_CHANGED,
  type ScheduleOverride,
} from '@/lib/schedule-overrides'
import { cn } from '@/lib/utils'

interface CourseLegendProps {
  activeCourse: string | null
  onToggle: (courseId: string | null) => void
  group?: GroupKey
}

export function CourseLegend({ activeCourse, onToggle, group = 'A' }: CourseLegendProps) {
  const [excluded, setExcluded] = useState<Exclude<CourseId, 'clubs'>[]>([])
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])

  useEffect(() => {
    const updateEx = () => setExcluded(getExcludedCourses())
    const updateOv = () => setOverrides(getScheduleOverrides())
    updateEx()
    updateOv()

    window.addEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOv)
    return () => {
      window.removeEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
      window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOv)
    }
  }, [])

  const labStats = getLabBreakdown(group, overrides, excluded)
  const isFdsaExcluded = excluded.includes('fdsa')

  const toggleFdsaEnrollment = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = isFdsaExcluded
      ? excluded.filter((id) => id !== 'fdsa')
      : [...excluded, 'fdsa' as const]
    setExcluded(next)
    saveExcludedCourses(next)
  }

  return (
    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
      {/* Course pills */}
      <div className="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
        {COURSE_ORDER.map((id) => {
          const course = timetable.courses[id]
          if (!course) return null
          const isActive = activeCourse === id
          const isExcluded = id !== 'clubs' && excluded.includes(id)
          const dimmed = (activeCourse !== null && !isActive) || isExcluded

          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(isActive ? null : id)}
              aria-pressed={isActive}
              className={cn(
                courseClass(id),
                'group flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                'border-[color:var(--c-border)] bg-[color:var(--c-soft)] text-[color:var(--c-text)]',
                'hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                dimmed && 'opacity-40 grayscale-[0.3]',
                isExcluded && 'line-through decoration-destructive/80',
              )}
            >
              <span
                aria-hidden
                className="size-2 rounded-full bg-[color:var(--c-solid)]"
              />
              <span className="whitespace-nowrap">{course.code}</span>
              <span className="hidden text-[color:var(--c-text)]/70 sm:inline">
                {course.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* FDSA Toggle Switch & Lab breakdown badge */}
      <div className="flex flex-wrap shrink-0 items-center gap-2">
        {/* FDSA Visibility Toggle Switch */}
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs">
          <span className="font-semibold text-rose-600 dark:text-rose-400">FDSA Classes & Labs</span>
          <button
            type="button"
            role="switch"
            aria-checked={!isFdsaExcluded}
            onClick={toggleFdsaEnrollment}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !isFdsaExcluded ? 'bg-rose-500' : 'bg-muted-foreground/30',
            )}
            title={!isFdsaExcluded ? 'FDSA visible in timetable. Click to hide.' : 'FDSA hidden in timetable. Click to show.'}
          >
            <span className="sr-only">Toggle FDSA visibility</span>
            <span
              className={cn(
                'pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out',
                !isFdsaExcluded ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
          <span className="text-[11px] font-bold text-muted-foreground">
            {!isFdsaExcluded ? 'Shown' : 'Hidden'}
          </span>
        </div>

        {/* Lab breakdown badge */}
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5 text-primary" />
          <span>
            <strong className="font-semibold text-foreground">{labStats.totalLabs} Labs</strong> (
            <span className="text-foreground">{labStats.mernLabs} MERN</span>
            {!isFdsaExcluded && labStats.fdsaLabs > 0 && (
              <> · <span className="text-foreground">{labStats.fdsaLabs} FDSA</span></>
            )}
            )
          </span>
        </div>
      </div>
    </div>
  )
}
