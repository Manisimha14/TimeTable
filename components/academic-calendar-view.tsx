'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarClock, ChevronLeft, ChevronRight, Flag, Plus } from 'lucide-react'
import {
  buildMonthGrid,
  calendarMonths,
  CAL_TYPE_META,
  eventsOn,
  fullDate,
  monthIndexFor,
  WEEKDAY_LABELS,
  type CalDayCell,
} from '@/lib/academic-calendar'
import { spring, weekSlide, staggerContainer, riseItem } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { CalendarLegend } from '@/components/calendar-legend'
import { HolidayIcon } from '@/components/holiday-icon'
import { loadPersonalDeadlines, savePersonalDeadlines } from '@/lib/personal-deadlines'

export function AcademicCalendarView() {
  const [today, setToday] = useState<Date | null>(() => {
    if (typeof window === 'undefined') return null
    return new Date()
  })
  const [monthIdx, setMonthIdx] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return monthIndexFor(new Date())
  })
  const [direction, setDirection] = useState<number>(0)
  const [selectedIso, setSelectedIso] = useState<string | null>(null)

  // Client-only clock so "today" highlighting matches the user's real date.
  useEffect(() => {
    const now = new Date()
    setToday(now)
    setMonthIdx(monthIndexFor(now))
  }, [])

  const month = calendarMonths[monthIdx]
  const cells = useMemo(
    () => (month ? buildMonthGrid(month.year, month.month, today ?? undefined) : []),
    [month, today],
  )

  const first = 0
  const last = calendarMonths.length - 1
  const onCurrentMonth = today ? monthIdx === monthIndexFor(today) : false

  const go = (target: number) => {
    const clamped = Math.min(last, Math.max(first, target))
    if (clamped === monthIdx) return
    setDirection(clamped > monthIdx ? 1 : -1)
    setMonthIdx(clamped)
    setSelectedIso(null)
  }

  const selectedEvents = selectedIso ? eventsOn(selectedIso) : []
  const addDeadline = () => {
    if (!selectedIso) return
    const current = loadPersonalDeadlines()
    if (current.some((deadline) => deadline.date === selectedIso && deadline.title === 'Personal deadline')) return
    savePersonalDeadlines([...current, { id: crypto.randomUUID(), date: selectedIso, title: 'Personal deadline', note: 'Added from the academic calendar.' }])
  }

  if (!today || !month) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="relative flex size-12 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="text-base font-bold text-primary">⏳</span>
        </div>
        <p className="font-display text-base font-bold text-foreground animate-pulse">
          Aagu Bro... 🛑 Loading Calendar Data!
        </p>
        <p className="text-xs text-muted-foreground">
          Academic schedule and key dates loading fast for you ⚡
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <NavButton ariaLabel="Previous month" disabled={monthIdx <= first} onClick={() => go(monthIdx - 1)}>
            <ChevronLeft className="size-4" />
          </NavButton>
          <div className="min-w-[10.5rem] px-1 text-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.h2
                key={month.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring}
                className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl"
              >
                {month.label}
              </motion.h2>
            </AnimatePresence>
          </div>
          <NavButton ariaLabel="Next month" disabled={monthIdx >= last} onClick={() => go(monthIdx + 1)}>
            <ChevronRight className="size-4" />
          </NavButton>
        </div>

        {today && !onCurrentMonth && (
          <button
            type="button"
            onClick={() => go(monthIndexFor(today))}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/50 hover:text-primary"
          >
            <CalendarClock className="size-3.5" />
            Today
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={month.label}
            custom={direction}
            variants={weekSlide}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid grid-cols-7"
          >
            {cells.map((cell) => (
              <DayCell
                key={cell.iso}
                cell={cell}
                selected={cell.iso === selectedIso}
                onSelect={() => setSelectedIso(cell.iso)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
        <CalendarLegend />
      </div>

      {/* Selected-day detail */}
      <AnimatePresence mode="wait">
        {selectedIso && (
          <motion.div
            key={selectedIso}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -6 }}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <motion.p variants={riseItem} className="text-sm font-semibold text-foreground">
              {fullDate(selectedIso)}
            </motion.p>
            <div className="mt-3 space-y-2">
              {selectedEvents.map((ev, i) => {
                const meta = CAL_TYPE_META[ev.type]
                return (
                  <motion.div
                    key={`${ev.type}-${i}`}
                    variants={riseItem}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ backgroundColor: meta.soft }}
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.solid }}
                    />
                    <span className="text-sm font-medium" style={{ color: meta.text }}>
                      {ev.label}
                    </span>
                    <span
                      className="ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: meta.solid, color: 'var(--card)' }}
                    >
                      {meta.label}
                    </span>
                  </motion.div>
                )
              })}
            </div>
            <button type="button" onClick={addDeadline} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"><Plus className="size-3.5" /><Flag className="size-3.5" /> Add personal deadline</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DayCell({
  cell,
  selected,
  onSelect,
}: {
  cell: CalDayCell
  selected: boolean
  onSelect: () => void
}) {
  const primary = cell.events[0]
  const meta = primary ? CAL_TYPE_META[primary.type] : null
  const hasEvents = cell.events.length > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={
        hasEvents
          ? `${cell.iso}: ${cell.events.map((e) => e.label).join(', ')}`
          : cell.iso
      }
      className={cn(
        'relative flex min-h-[68px] flex-col border-b border-r border-border/70 p-1.5 text-left transition sm:min-h-[92px]',
        '[&:nth-child(7n)]:border-r-0',
        !cell.inMonth && 'opacity-35',
        'cursor-pointer hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected && 'ring-2 ring-inset ring-primary',
      )}
      style={meta ? { backgroundColor: meta.soft } : undefined}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
          cell.isToday && 'bg-primary text-primary-foreground',
        )}
        style={!cell.isToday && meta ? { color: meta.text } : undefined}
      >
        {cell.day}
      </span>

      {primary?.type === 'holiday' && (
        <HolidayIcon label={primary.label} className="absolute right-1.5 top-1.5 size-3.5" style={{ color: meta?.solid }} aria-label="Holiday" />
      )}

      {/* Desktop: label text. Mobile: colored dot(s). */}
      {hasEvents && meta && (
        <>
          <span
            className="mt-1 hidden truncate text-[10px] font-medium leading-tight sm:block"
            style={{ color: meta.text }}
          >
            {primary!.label}
          </span>
          <span className="mt-auto flex gap-0.5 sm:hidden" aria-hidden>
            {cell.events.slice(0, 3).map((e, i) => (
              <span
                key={i}
                className="size-1.5 rounded-full"
                style={{ backgroundColor: CAL_TYPE_META[e.type].solid }}
              />
            ))}
          </span>
        </>
      )}
    </button>
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
