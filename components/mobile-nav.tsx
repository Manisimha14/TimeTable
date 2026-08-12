'use client'

import { motion } from 'motion/react'
import { Calendar, CalendarDays, BookOpen, Flag, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { spring } from '@/lib/motion'

export type NavView = 'timetable' | 'calendar' | 'courses' | 'personal' | 'tools'

interface MobileBottomNavProps {
  currentView: NavView
  onSelectView: (view: NavView) => void
  unloggedCount?: number
  backlogCount?: number
  deadlinesCount?: number
}

const NAV_ITEMS: { id: NavView; label: string; icon: any }[] = [
  { id: 'timetable', label: 'Schedule', icon: Calendar },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'personal', label: 'Deadlines', icon: Flag },
  { id: 'tools', label: 'Tools', icon: Wrench },
]

export function MobileBottomNav({
  currentView,
  onSelectView,
  unloggedCount = 0,
  backlogCount = 0,
  deadlinesCount = 0,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 block sm:hidden bg-card/90 backdrop-blur-xl border-t border-border/60 py-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg select-none"
    >
      <div className="flex items-center justify-around gap-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isSelected = currentView === id
          const badge =
            id === 'timetable'
              ? unloggedCount
              : id === 'courses'
                ? backlogCount
                : id === 'personal'
                  ? deadlinesCount
                  : 0

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectView(id)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95 min-h-[48px]',
                isSelected ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground font-medium',
              )}
            >
              {isSelected && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/20"
                />
              )}
              <div className="relative">
                <Icon className={cn('size-5 shrink-0 transition-transform', isSelected && 'scale-110')} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-extrabold text-white shadow-xs animate-pulse">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="relative mt-0.5 text-[11px] leading-none tracking-tight">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
