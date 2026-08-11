'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CirclePlus, Flag, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { defaultPersonalDeadlines, deadlineDateLabel, PERSONAL_DEADLINES_CHANGED, PERSONAL_DEADLINES_STORE_KEY, type PersonalDeadline } from '@/lib/personal-deadlines'
import { riseItem, staggerContainer } from '@/lib/motion'

export function PersonalDeadlinesTab() {
  const [deadlines, setDeadlines] = useState<PersonalDeadline[]>(defaultPersonalDeadlines)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const ordered = useMemo(() => [...deadlines].sort((a, b) => a.date.localeCompare(b.date)), [deadlines])

  const addDeadline = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !date) return
    saveDeadlines([
      ...deadlines,
      { id: `${date}-${title}`, title: title.trim(), date, note: note.trim() },
    ])
    setTitle('')
    setDate('')
    setNote('')
  }

  // Personal data stays on this device, including after switching dashboard tabs.
  const saveDeadlines = (next: PersonalDeadline[]) => {
    setDeadlines(next)
    window.localStorage.setItem(PERSONAL_DEADLINES_STORE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(PERSONAL_DEADLINES_CHANGED))
  }

  useEffect(() => {
    const update = () => {
      try {
        const saved = window.localStorage.getItem(PERSONAL_DEADLINES_STORE_KEY)
        if (saved) setDeadlines(JSON.parse(saved) as PersonalDeadline[])
      } catch { /* Keep default */ }
    }
    update()
    window.addEventListener(PERSONAL_DEADLINES_CHANGED, update)
    return () => window.removeEventListener(PERSONAL_DEADLINES_CHANGED, update)
  }, [])

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Flag className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Personal deadlines</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Keep the work that matters beside your academic calendar.</p>
          </div>
        </div>

        <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
          {ordered.map((deadline) => (
            <motion.li key={deadline.id} variants={riseItem} className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CheckCircle2 className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{deadline.title}</p>
                {deadline.note && <p className="truncate text-xs text-muted-foreground">{deadline.note}</p>}
                <span className="mt-1 inline-flex rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {deadlineDateLabel(deadline.date)}
                </span>
              </div>
              <button type="button" onClick={() => saveDeadlines(deadlines.filter((item) => item.id !== deadline.id))} aria-label={`Remove ${deadline.title}`} className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Trash2 className="size-4" />
              </button>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <form onSubmit={addDeadline} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><CirclePlus className="size-4 text-primary" /> Add a deadline</h2>
        <div className="mt-4 space-y-3">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Finish FDSA assignment" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <input value={date} onChange={(event) => setDate(event.target.value)} type="date" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" rows={3} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95"><CirclePlus className="size-4" /> Add deadline</button>
        </div>
      </form>
    </div>
  )
}
