'use client'

import { CAL_TYPE_META, presentTypes } from '@/lib/academic-calendar'
import { cn } from '@/lib/utils'

interface CalendarLegendProps {
  className?: string
}

/**
 * Legend for the academic-calendar day types. Renders only the types that
 * actually appear in the parsed data, each with the same solid swatch color
 * used to tint the matching day cells so the two stay perfectly in sync.
 */
export function CalendarLegend({ className }: CalendarLegendProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {presentTypes.map((type) => {
        const meta = CAL_TYPE_META[type]
        return (
          <span key={type} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: meta.solid }}
            />
            {meta.label}
          </span>
        )
      })}
    </div>
  )
}
