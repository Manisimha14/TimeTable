import {
  Flag,
  HeartHandshake,
  Landmark,
  MoonStar,
  PartyPopper,
  Sparkles,
  type LucideProps,
} from 'lucide-react'

/** A recognisable icon for holidays represented in the academic calendar. */
export function HolidayIcon({ label, ...props }: { label?: string | null } & LucideProps) {
  const name = (label ?? '').toLowerCase()
  if (name.includes('independence')) return <Flag {...props} />
  if (name.includes('eid') || name.includes('moharam') || name.includes('ramzan')) return <MoonStar {...props} />
  if (name.includes('gandhi') || name.includes('ambedkar')) return <Landmark {...props} />
  if (name.includes('raksha') || name.includes('onam') || name.includes('ganesh')) return <HeartHandshake {...props} />
  if (name.includes('christmas') || name.includes('new year') || name.includes('diwali')) return <PartyPopper {...props} />
  return <Sparkles {...props} />
}
