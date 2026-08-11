export interface PersonalDeadline {
  id: string
  title: string
  date: string
  note: string
}

export const PERSONAL_DEADLINES_STORE_KEY = 'academic-dashboard-personal-deadlines'
export const PERSONAL_DEADLINES_CHANGED = 'academic-dashboard-personal-deadlines-changed'

// A useful starter item that students can replace from the Personal tab.
export const defaultPersonalDeadlines: PersonalDeadline[] = [
  {
    id: 'portfolio-review',
    title: 'Portfolio review',
    date: '2026-08-21',
    note: 'Polish your project summary and bring questions for feedback.',
  },
]

export function loadPersonalDeadlines(): PersonalDeadline[] {
  if (typeof window === 'undefined') return defaultPersonalDeadlines
  try {
    const saved = window.localStorage.getItem(PERSONAL_DEADLINES_STORE_KEY)
    return saved ? (JSON.parse(saved) as PersonalDeadline[]) : defaultPersonalDeadlines
  } catch { return defaultPersonalDeadlines }
}

export function savePersonalDeadlines(deadlines: PersonalDeadline[]) {
  window.localStorage.setItem(PERSONAL_DEADLINES_STORE_KEY, JSON.stringify(deadlines))
  window.dispatchEvent(new Event(PERSONAL_DEADLINES_CHANGED))
}

export function deadlineDateLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
