'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  Flame,
  Globe,
  Kanban,
  Lock,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Wrench,
  X,
} from 'lucide-react'
import {
  COURSE_ORDER,
  exportCalendarIcal,
  timetable,
  type CourseId,
  type GroupKey,
  type ViewId,
} from '@/lib/timetable'
import { cn } from '@/lib/utils'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: ViewId
  onSelectView: (view: ViewId) => void
  group: GroupKey
  onSelectGroup: (group: GroupKey) => void
  onOpenSessionManager: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  view,
  onSelectView,
  group,
  onSelectGroup,
  onOpenSessionManager,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  const q = query.trim().toLowerCase()

  const commands = [
    // Views
    {
      category: 'Views & Navigation',
      id: 'view-timetable',
      title: 'Weekly Timetable View',
      icon: CalendarRange,
      action: () => {
        onSelectView('timetable')
        onOpenChange(false)
      },
    },
    {
      category: 'Views & Navigation',
      id: 'view-calendar',
      title: 'Academic Calendar (All Batches)',
      icon: Calendar,
      action: () => {
        onSelectView('calendar')
        onOpenChange(false)
      },
    },
    {
      category: 'Views & Navigation',
      id: 'view-courses',
      title: 'Term 5 Course Breakdown & Syllabus',
      icon: Compass,
      action: () => {
        onSelectView('courses')
        onOpenChange(false)
      },
    },
    {
      category: 'Views & Navigation',
      id: 'view-personal',
      title: 'Personal Deadlines & Priorities',
      icon: Kanban,
      action: () => {
        onSelectView('personal')
        onOpenChange(false)
      },
    },
    {
      category: 'Views & Navigation',
      id: 'view-tools',
      title: 'Student Study Toolkit & Cloud Sync',
      icon: Wrench,
      action: () => {
        onSelectView('tools')
        onOpenChange(false)
      },
    },
    // Groups
    {
      category: 'Select Group',
      id: 'group-a',
      title: 'Switch / Lock Group A',
      icon: Lock,
      action: () => {
        onSelectGroup('A')
        onOpenChange(false)
      },
    },
    {
      category: 'Select Group',
      id: 'group-b',
      title: 'Switch / Lock Group B',
      icon: Lock,
      action: () => {
        onSelectGroup('B')
        onOpenChange(false)
      },
    },
    {
      category: 'Select Group',
      id: 'group-c',
      title: 'Switch / Lock Group C',
      icon: Lock,
      action: () => {
        onSelectGroup('C')
        onOpenChange(false)
      },
    },
    // Tools & Quick Actions
    {
      category: 'Quick Actions',
      id: 'session-manager',
      title: 'Open Session Attendance Manager',
      icon: Clock,
      action: () => {
        onOpenSessionManager()
        onOpenChange(false)
      },
    },
    {
      category: 'Quick Actions',
      id: 'export-ical',
      title: `Export Group ${group} iCal (.ics) Calendar`,
      icon: Download,
      action: () => {
        exportCalendarIcal(group)
        onOpenChange(false)
      },
    },
  ]

  const filteredCommands = commands.filter(
    (c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
  )

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-3">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Palette Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
          >
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-border px-4 py-3">
              <Search className="size-4.5 shrink-0 text-muted-foreground mr-2.5" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, views, groups, or actions... (Esc to close)"
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Command List */}
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No commands matching &quot;{query}&quot;
                </div>
              ) : (
                filteredCommands.map((cmd) => {
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={cmd.action}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="size-4 shrink-0 text-primary" />
                        <span className="truncate">{cmd.title}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground shrink-0 rounded-md bg-muted px-2 py-0.5">
                        {cmd.category}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer tip */}
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
              <span>ProTip: Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold border border-border">⌘K</kbd> or <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold border border-border">Ctrl+K</kbd> anytime</span>
              <span className="font-semibold text-primary">SST 2029 Term 5</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
