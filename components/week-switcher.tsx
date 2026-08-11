'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, CalendarClock, Dot } from 'lucide-react'
import { WEEKS } from '@/lib/timetable'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface WeekSwitcherProps {
  weekIndex: number
  currentWeek: number
  onChange: (index: number, direction: number) => void
}

export function WeekSwitcher({ weekIndex, currentWeek, onChange }: WeekSwitcherProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const first = WEEKS[0].index
  const last = WEEKS[WEEKS.length - 1].index
  const active = WEEKS.find((w) => w.index === weekIndex) ?? WEEKS[0]

  // Keep the active pill scrolled into view when the week changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [weekIndex])

  const go = (target: number) => {
    const clamped = Math.min(last, Math.max(first, target))
    if (clamped !== weekIndex) onChange(clamped, clamped > weekIndex ? 1 : -1)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-2.5 sm:flex-row sm:items-center">
      {/* Prev / current label / next */}
      <div className="flex items-center gap-1">
        <NavButton
          ariaLabel="Previous week"
          disabled={weekIndex <= first}
          onClick={() => go(weekIndex - 1)}
        >
          <ChevronLeft className="size-4" />
        </NavButton>

        <div className="flex min-w-[9.5rem] flex-col items-center px-1 text-center">
          <span className="text-sm font-semibold text-foreground">
            Week {active.index}
            {active.index === currentWeek && (
              <span className="ml-1 text-primary">· now</span>
            )}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{active.label}</span>
        </div>

        <NavButton
          ariaLabel="Next week"
          disabled={weekIndex >= last}
          onClick={() => go(weekIndex + 1)}
        >
          <ChevronRight className="size-4" />
        </NavButton>
      </div>

      <span className="hidden h-8 w-px bg-border sm:block" aria-hidden />

      {/* Week pill strip */}
      <div
        ref={stripRef}
        className="scrollbar-none -mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5"
        role="tablist"
        aria-label="Select term week"
      >
        {WEEKS.map((w) => {
          const isActive = w.index === weekIndex
          const isNow = w.index === currentWeek
          return (
            <button
              key={w.index}
              ref={isActive ? activeRef : undefined}
              role="tab"
              aria-selected={isActive}
              onClick={() => go(w.index)}
              className={cn(
                'relative shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="week-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                />
              )}
              <span className="relative flex items-center gap-0.5 whitespace-nowrap tabular-nums">
                W{w.index}
                {isNow && (
                  <Dot
                    className={cn(
                      '-mx-1 size-4',
                      isActive ? 'text-primary-foreground' : 'text-primary',
                    )}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Jump to current week */}
      {weekIndex !== currentWeek && (
        <button
          type="button"
          onClick={() => go(currentWeek)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <CalendarClock className="size-3.5" />
          This week
        </button>
      )}
    </div>
  )
}

function NavButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
