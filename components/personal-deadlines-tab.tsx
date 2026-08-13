'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  CirclePlus,
  Filter,
  Flag,
  Plus,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  addPersonalDeadline,
  deadlineDateLabel,
  deleteDeadline,
  loadPersonalDeadlines,
  PERSONAL_DEADLINES_CHANGED,
  toggleDeadlineCompleted,
  type PersonalDeadline,
} from '@/lib/personal-deadlines'
import { type CourseId } from '@/lib/timetable'
import { riseItem, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function PersonalDeadlinesTab() {
  const [deadlines, setDeadlines] = useState<PersonalDeadline[]>(loadPersonalDeadlines)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'high'>('all')

  // Form states
  const [title, setTitle] = useState('')
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().slice(0, 10)
  })
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [courseId, setCourseId] = useState<CourseId | 'general'>('general')

  useEffect(() => {
    const update = () => setDeadlines(loadPersonalDeadlines())
    update()
    window.addEventListener(PERSONAL_DEADLINES_CHANGED, update)
    return () => window.removeEventListener(PERSONAL_DEADLINES_CHANGED, update)
  }, [])

  const filteredDeadlines = useMemo(() => {
    let list = [...deadlines]
    if (filter === 'pending') list = list.filter((d) => !d.completed)
    if (filter === 'completed') list = list.filter((d) => d.completed)
    if (filter === 'high') list = list.filter((d) => d.priority === 'high')
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      return a.date.localeCompare(b.date)
    })
  }, [deadlines, filter])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dateStr) return
    addPersonalDeadline({
      title: title.trim(),
      date: dateStr,
      note: note.trim(),
      priority,
      courseId,
    })
    setTitle('')
    setNote('')
  }

  const setPresetDate = (offsetDays: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    setDateStr(d.toISOString().slice(0, 10))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Left Column: Deadlines List */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Flag className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                Personal Deadlines & Tasks
              </h2>
              <p className="text-xs text-muted-foreground">
                Track assignments, quizzes, and personal milestones alongside Term 5 schedule.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'completed', label: 'Done' },
                { id: 'high', label: '🔴 High' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95',
                  filter === f.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Deadlines List */}
        <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {filteredDeadlines.map((item) => (
              <motion.li
                key={item.id}
                variants={riseItem}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  'group flex items-start gap-3 rounded-2xl border p-3.5 transition-all shadow-xs',
                  item.completed
                    ? 'border-border/40 bg-muted/20 opacity-70'
                    : item.priority === 'high'
                      ? 'border-red-500/30 bg-red-500/5 dark:bg-red-500/10'
                      : 'border-border bg-card hover:border-primary/40',
                )}
              >
                {/* Completion Toggle Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleDeadlineCompleted(item.id)}
                  className="mt-0.5 shrink-0 rounded-full text-muted-foreground transition hover:text-primary active:scale-90"
                  aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {item.completed ? (
                    <CheckCircle2 className="size-5 text-emerald-500 fill-emerald-500/20" />
                  ) : (
                    <Circle className="size-5 hover:text-primary" />
                  )}
                </button>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        'text-sm font-bold text-foreground transition-all',
                        item.completed && 'line-through text-muted-foreground',
                      )}
                    >
                      {item.title}
                    </p>

                    {/* Priority Badge */}
                    {item.priority === 'high' && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400 border border-red-500/20">
                        High Priority
                      </span>
                    )}
                    {item.priority === 'medium' && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Medium
                      </span>
                    )}

                    {/* Course Tag */}
                    {item.courseId && item.courseId !== 'general' && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary border border-primary/20">
                        {item.courseId.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}

                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground pt-0.5">
                    <Calendar className="size-3 text-primary" />
                    <span>Due: {deadlineDateLabel(item.date)}</span>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => deleteDeadline(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive active:scale-95"
                >
                  <Trash2 className="size-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>

          {filteredDeadlines.length === 0 && (
            <motion.div variants={riseItem} className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm font-semibold text-foreground">No deadlines found in this view</p>
              <p className="mt-1 text-xs text-muted-foreground">Add a new deadline on the right panel to stay ahead!</p>
            </motion.div>
          )}
        </motion.ul>
      </section>

      {/* Right Column: Add Deadline Form with Quick Presets */}
      <section className="space-y-4">
        <form onSubmit={handleAdd} className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-display text-base font-bold text-foreground border-b border-border/60 pb-3">
            <CirclePlus className="size-4 text-primary" /> Add New Deadline
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Deadline Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MERN Assignment Submission"
              required
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Due Date *</label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              <button
                type="button"
                onClick={() => setPresetDate(0)}
                className="rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-semibold hover:bg-primary/20 hover:text-primary active:scale-95 transition"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(1)}
                className="rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-semibold hover:bg-primary/20 hover:text-primary active:scale-95 transition"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(3)}
                className="rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-semibold hover:bg-primary/20 hover:text-primary active:scale-95 transition"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(7)}
                className="rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-semibold hover:bg-primary/20 hover:text-primary active:scale-95 transition"
              >
                +1 Week
              </button>
            </div>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              required
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Priority Pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Priority</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'low', label: '🔵 Low' },
                  { id: 'medium', label: '🟡 Med' },
                  { id: 'high', label: '🔴 High' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={cn(
                    'rounded-xl border py-1.5 text-xs font-bold transition active:scale-95',
                    priority === p.id
                      ? 'border-primary bg-primary/10 text-primary shadow-xs'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Course Tag */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Related Subject</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value as any)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
            >
              <option value="general">General / Personal</option>
              <option value="cml">CML — Machine Learning</option>
              <option value="mern">MERN — Web Dev</option>
              <option value="cn">CN — Computer Networks</option>
              <option value="fdsa">FDSA — Data Structures</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Optional Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bring hard copy and submission link ready"
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition hover:brightness-110 active:scale-95"
          >
            <Plus className="size-4" /> Save Deadline
          </button>
        </form>
      </section>
    </div>
  )
}
