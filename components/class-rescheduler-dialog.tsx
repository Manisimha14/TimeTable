'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Calendar,
  CalendarCheck,
  CalendarOff,
  CalendarPlus,
  Clock,
  FlaskConical,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
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
  COURSE_ORDER,
  courseClass,
  courseOccurrences,
  formatMinutes,
  fullDateLabel,
  timetable,
  type CourseId,
  type GroupKey,
} from '@/lib/timetable'
import {
  addScheduleOverride,
  getScheduleOverrides,
  removeScheduleOverride,
  SCHEDULE_OVERRIDES_CHANGED,
  type OverrideType,
  type ScheduleOverride,
} from '@/lib/schedule-overrides'
import { riseItem, spring, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface ClassReschedulerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: GroupKey
  initialEventKey?: string | null
}

type TabView = 'modify' | 'extra' | 'overrides'

export function ClassReschedulerDialog({
  open,
  onOpenChange,
  group,
  initialEventKey,
}: ClassReschedulerDialogProps) {
  const [tab, setTab] = useState<TabView>('modify')
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Exclude<CourseId, 'clubs'>>('cml')
  const [selectedOccKey, setSelectedOccKey] = useState<string>('')
  const [actionType, setActionType] = useState<'cancel' | 'reschedule'>('reschedule')

  // Form states for reschedule / extra
  const [targetDateIso, setTargetDateIso] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [startTimeStr, setStartTimeStr] = useState<string>('14:00')
  const [endTimeStr, setEndTimeStr] = useState<string>('15:30')
  const [room, setRoom] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [isLab, setIsLab] = useState<boolean>(false)
  const [extraTitle, setExtraTitle] = useState<string>('')

  useEffect(() => {
    const update = () => setOverrides(getScheduleOverrides())
    update()
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, update)
    return () => window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, update)
  }, [])

  // Auto-populate initial event key if provided
  useEffect(() => {
    if (initialEventKey) {
      setSelectedOccKey(initialEventKey)
      setTab('modify')
    }
  }, [initialEventKey])

  const occurrences = useMemo(() => {
    return courseOccurrences(group, selectedCourse, []) // Raw occurrences without overrides applied
  }, [group, selectedCourse])

  useEffect(() => {
    if (occurrences.length > 0 && !selectedOccKey) {
      setSelectedOccKey(occurrences[0].key)
    }
  }, [occurrences, selectedOccKey])

  const selectedOccurrence = useMemo(() => {
    return occurrences.find((occ) => occ.key === selectedOccKey) ?? occurrences[0]
  }, [occurrences, selectedOccKey])

  const parseMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number)
    return (h ?? 14) * 60 + (m ?? 0)
  }

  const handleModifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOccurrence) return

    if (actionType === 'cancel') {
      addScheduleOverride({
        id: crypto.randomUUID(),
        type: 'cancel',
        originalKey: selectedOccurrence.key,
        originalCode: selectedOccurrence.code,
        originalDateIso: new Date(selectedOccurrence.ms).toISOString().slice(0, 10),
        originalTimeLabel: `${formatMinutes(selectedOccurrence.startMin)} - ${formatMinutes(selectedOccurrence.endMin)}`,
        courseId: selectedCourse,
        dateIso: new Date(selectedOccurrence.ms).toISOString().slice(0, 10),
        startMin: selectedOccurrence.startMin,
        endMin: selectedOccurrence.endMin,
        note: note.trim() || 'Cancelled class session',
      })
    } else {
      addScheduleOverride({
        id: crypto.randomUUID(),
        type: 'reschedule',
        originalKey: selectedOccurrence.key,
        originalCode: selectedOccurrence.code,
        originalDateIso: new Date(selectedOccurrence.ms).toISOString().slice(0, 10),
        originalTimeLabel: `${formatMinutes(selectedOccurrence.startMin)} - ${formatMinutes(selectedOccurrence.endMin)}`,
        courseId: selectedCourse,
        dateIso: targetDateIso,
        startMin: parseMinutes(startTimeStr),
        endMin: parseMinutes(endTimeStr),
        room: room.trim() || 'Classroom',
        note: note.trim() || 'Rescheduled class session',
        isLab: selectedOccurrence.isLab,
      })
    }

    setNote('')
    setTab('overrides')
  }

  const handleExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetDateIso) return

    addScheduleOverride({
      id: crypto.randomUUID(),
      type: 'extra',
      courseId: selectedCourse,
      dateIso: targetDateIso,
      startMin: parseMinutes(startTimeStr),
      endMin: parseMinutes(endTimeStr),
      room: room.trim() || 'Classroom',
      note: note.trim() || 'Extra makeup session',
      isLab,
      title: extraTitle.trim() || 'Makeup Session',
    })

    setExtraTitle('')
    setNote('')
    setTab('overrides')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border bg-card p-5 text-left sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarPlus className="size-5" />
            </span>
            <div>
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Class Rescheduler & Customizer
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cancel, reschedule, or add extra makeup classes to your timetable
              </DialogDescription>
            </div>
          </div>

          {/* Sub-nav tabs */}
          <div className="mt-4 flex rounded-xl border border-border bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setTab('modify')}
              className={cn(
                'relative flex-1 rounded-lg py-1.5 text-center text-xs font-semibold transition',
                tab === 'modify'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'modify' && (
                <motion.span
                  layoutId="rescheduler-tab-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-lg bg-card shadow-sm"
                />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                <CalendarOff className="size-3.5" />
                Reschedule / Cancel
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTab('extra')}
              className={cn(
                'relative flex-1 rounded-lg py-1.5 text-center text-xs font-semibold transition',
                tab === 'extra'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'extra' && (
                <motion.span
                  layoutId="rescheduler-tab-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-lg bg-card shadow-sm"
                />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                <Plus className="size-3.5" />
                Extra Class
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTab('overrides')}
              className={cn(
                'relative flex-1 rounded-lg py-1.5 text-center text-xs font-semibold transition',
                tab === 'overrides'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'overrides' && (
                <motion.span
                  layoutId="rescheduler-tab-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-lg bg-card shadow-sm"
                />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                Active Overrides
                {overrides.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
                    {overrides.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </DialogHeader>

        {/* Tab contents */}
        <ScrollArea className="max-h-[60vh] p-5 sm:p-6">
          {tab === 'modify' && (
            <form onSubmit={handleModifySubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Select Course
                  <select
                    value={selectedCourse}
                    onChange={(e) => {
                      setSelectedCourse(e.target.value as Exclude<CourseId, 'clubs'>)
                      setSelectedOccKey('')
                    }}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {COURSE_ORDER.filter((id) => id !== 'clubs').map((id) => (
                      <option key={id} value={id}>
                        {timetable.courses[id]?.code} · {timetable.courses[id]?.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-muted-foreground">
                  Select Scheduled Session
                  <select
                    value={selectedOccKey}
                    onChange={(e) => setSelectedOccKey(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {occurrences.map((occ) => (
                      <option key={occ.key} value={occ.key}>
                        {fullDateLabel(occ.ms).slice(0, 10)} ({formatMinutes(occ.startMin)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedOccurrence && (
                <div
                  className={cn(
                    courseClass(selectedCourse),
                    'rounded-xl border border-[color:var(--c-border)] bg-[color:var(--c-soft)]/50 p-3.5 text-xs text-[color:var(--c-text)]',
                  )}
                >
                  <p className="font-bold">
                    Targeting: {selectedOccurrence.code}{' '}
                    {selectedOccurrence.isLab ? 'Lab' : 'Session'}
                  </p>
                  <p className="mt-0.5 opacity-80">
                    Original Date: {fullDateLabel(selectedOccurrence.ms)} ·{' '}
                    {formatMinutes(selectedOccurrence.startMin)} –{' '}
                    {formatMinutes(selectedOccurrence.endMin)}
                  </p>
                </div>
              )}

              {/* Action selection */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  Choose Action
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActionType('reschedule')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition',
                      actionType === 'reschedule'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Calendar className="size-4" /> Reschedule to new date
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('cancel')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition',
                      actionType === 'cancel'
                        ? 'border-destructive bg-destructive/10 text-destructive shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <CalendarOff className="size-4" /> Cancel class session
                  </button>
                </div>
              </div>

              {actionType === 'reschedule' && (
                <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    New Date & Time
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-muted-foreground sm:col-span-1">
                      New Date
                      <input
                        type="date"
                        value={targetDateIso}
                        onChange={(e) => setTargetDateIso(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
                      />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                      Start Time
                      <input
                        type="time"
                        value={startTimeStr}
                        onChange={(e) => setStartTimeStr(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
                      />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                      End Time
                      <input
                        type="time"
                        value={endTimeStr}
                        onChange={(e) => setEndTimeStr(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-semibold text-muted-foreground">
                    Room (Optional)
                    <input
                      type="text"
                      placeholder="e.g. Lab 2 / Room B"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </label>
                </div>
              )}

              <label className="block text-xs font-semibold text-muted-foreground">
                Reason / Note (Optional)
                <input
                  type="text"
                  placeholder="e.g. Professor request / Festival shift"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>

              <button
                type="submit"
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:brightness-95',
                  actionType === 'cancel' ? 'bg-destructive' : 'bg-primary',
                )}
              >
                {actionType === 'cancel' ? (
                  <>
                    <CalendarOff className="size-4" /> Cancel Class Session
                  </>
                ) : (
                  <>
                    <CalendarCheck className="size-4" /> Confirm Reschedule
                  </>
                )}
              </button>
            </form>
          )}

          {tab === 'extra' && (
            <form onSubmit={handleExtraSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Select Course
                  <select
                    value={selectedCourse}
                    onChange={(e) =>
                      setSelectedCourse(e.target.value as Exclude<CourseId, 'clubs'>)
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {COURSE_ORDER.filter((id) => id !== 'clubs').map((id) => (
                      <option key={id} value={id}>
                        {timetable.courses[id]?.code} · {timetable.courses[id]?.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-muted-foreground">
                  Session Type
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLab(false)}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-xs font-semibold transition',
                        !isLab
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground',
                      )}
                    >
                      Theory Class
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLab(true)}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-xs font-semibold transition',
                        isLab
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground',
                      )}
                    >
                      Practical Lab
                    </button>
                  </div>
                </label>
              </div>

              <label className="block text-xs font-semibold text-muted-foreground">
                Session Title / Description
                <input
                  type="text"
                  placeholder="e.g. Extra Revision Class / Project Lab"
                  value={extraTitle}
                  onChange={(e) => setExtraTitle(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-muted-foreground">
                  Date
                  <input
                    type="date"
                    value={targetDateIso}
                    onChange={(e) => setTargetDateIso(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </label>

                <label className="text-xs font-semibold text-muted-foreground">
                  Start Time
                  <input
                    type="time"
                    value={startTimeStr}
                    onChange={(e) => setStartTimeStr(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </label>

                <label className="text-xs font-semibold text-muted-foreground">
                  End Time
                  <input
                    type="time"
                    value={endTimeStr}
                    onChange={(e) => setEndTimeStr(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-muted-foreground">
                Room (Optional)
                <input
                  type="text"
                  placeholder="e.g. Room A / Computer Lab 1"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:brightness-95"
              >
                <Plus className="size-4" /> Add Extra Class Session
              </button>
            </form>
          )}

          {tab === 'overrides' && (
            <div>
              {overrides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Sparkles className="size-7" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold text-foreground">
                    No active schedule overrides
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Any classes you reschedule, cancel, or add as extra makeup sessions will be listed here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {overrides.map((ov) => (
                    <li
                      key={ov.id}
                      className={cn(
                        courseClass(ov.courseId),
                        'flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--c-border)] bg-[color:var(--c-soft)]/50 p-4',
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                              ov.type === 'cancel'
                                ? 'bg-destructive text-destructive-foreground'
                                : ov.type === 'reschedule'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-emerald-600 text-white',
                            )}
                          >
                            {ov.type}
                          </span>
                          <span className="font-bold text-xs text-foreground">
                            {timetable.courses[ov.courseId]?.code}
                          </span>
                        </div>

                        {ov.type === 'cancel' && (
                          <p className="text-xs font-medium text-foreground">
                            Cancelled class from {ov.originalDateIso} ({ov.originalTimeLabel})
                          </p>
                        )}

                        {ov.type === 'reschedule' && (
                          <p className="text-xs font-medium text-foreground">
                            Rescheduled from {ov.originalDateIso} to{' '}
                            <strong>{ov.dateIso}</strong> ({formatMinutes(ov.startMin)} –{' '}
                            {formatMinutes(ov.endMin)})
                          </p>
                        )}

                        {ov.type === 'extra' && (
                          <p className="text-xs font-medium text-foreground">
                            Extra {ov.isLab ? 'Lab' : 'Class'} on{' '}
                            <strong>{ov.dateIso}</strong> ({formatMinutes(ov.startMin)} –{' '}
                            {formatMinutes(ov.endMin)})
                          </p>
                        )}

                        {ov.note && (
                          <p className="text-[11px] text-muted-foreground">{ov.note}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeScheduleOverride(ov.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                        title="Remove override"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
