'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { COURSE_ORDER, courseClass, timetable, type CourseId } from '@/lib/timetable'
import { spring, staggerContainer, riseItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { CourseDetail } from '@/components/course-detail'

interface CoursesTabProps {
  initialCourse?: string | null
}

export function CoursesTab({ initialCourse }: CoursesTabProps) {
  const list = COURSE_ORDER.filter((id) => timetable.courses[id])
  const initial =
    (initialCourse && list.includes(initialCourse as CourseId)
      ? (initialCourse as CourseId)
      : null) ?? list[0]
  const [selected, setSelected] = useState<CourseId>(initial)
  const course = timetable.courses[selected]

  return (
    <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
      {/* Master list */}
      <motion.nav
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        aria-label="Courses"
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {list.map((id) => {
          const c = timetable.courses[id]
          const isActive = id === selected
          return (
            <motion.button
              key={id}
              variants={riseItem}
              type="button"
              onClick={() => setSelected(id)}
              aria-pressed={isActive}
              whileHover={{ scale: isActive ? 1 : 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                courseClass(id),
                'group relative flex min-w-[15rem] shrink-0 items-center gap-3 rounded-xl border p-3 text-left transition lg:min-w-0',
                isActive
                  ? 'border-[color:var(--c-border)] bg-[color:var(--c-soft)] shadow-sm'
                  : 'border-border bg-card hover:border-[color:var(--c-border)]',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="course-rail"
                  transition={spring}
                  className="absolute inset-y-2 left-0 w-1 rounded-full bg-[color:var(--c-solid)]"
                />
              )}
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--c-solid)] text-[11px] font-bold uppercase text-white"
                aria-hidden
              >
                {c.code.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {c.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {c.sessions.length} sessions · {c.evaluations.length} criteria
                </span>
              </span>
              <ChevronRight
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition',
                  isActive ? 'text-[color:var(--c-text)]' : 'group-hover:translate-x-0.5',
                )}
              />
            </motion.button>
          )
        })}
      </motion.nav>

      {/* Detail */}
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <CourseDetail course={course} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
