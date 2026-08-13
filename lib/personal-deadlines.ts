import { pushRealtimeSync, type CourseId } from './timetable'

export interface PersonalDeadline {
  id: string
  title: string
  date: string
  note?: string
  completed?: boolean
  priority?: 'high' | 'medium' | 'low'
  courseId?: CourseId | 'general'
}

export const PERSONAL_DEADLINES_STORE_KEY = 'academic-dashboard-personal-deadlines'
export const PERSONAL_DEADLINES_CHANGED = 'academic-dashboard-personal-deadlines-changed'

export const defaultPersonalDeadlines: PersonalDeadline[] = [
  {
    id: 'portfolio-review',
    title: 'Portfolio review',
    date: '2026-08-21',
    note: 'Polish your project summary and bring questions for feedback.',
    completed: false,
    priority: 'high',
    courseId: 'mern',
  },
]

export function loadPersonalDeadlines(): PersonalDeadline[] {
  if (typeof window === 'undefined') return defaultPersonalDeadlines
  try {
    const saved = window.localStorage.getItem(PERSONAL_DEADLINES_STORE_KEY)
    if (!saved) return defaultPersonalDeadlines
    const parsed = JSON.parse(saved) as PersonalDeadline[]
    return Array.isArray(parsed) ? parsed : defaultPersonalDeadlines
  } catch {
    return defaultPersonalDeadlines
  }
}

export function savePersonalDeadlines(deadlines: PersonalDeadline[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERSONAL_DEADLINES_STORE_KEY, JSON.stringify(deadlines))
    window.dispatchEvent(new Event(PERSONAL_DEADLINES_CHANGED))
    pushRealtimeSync()
  } catch {}
}

export function addPersonalDeadline(item: Omit<PersonalDeadline, 'id'>): PersonalDeadline {
  const list = loadPersonalDeadlines()
  const newDeadline: PersonalDeadline = {
    id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    completed: false,
    priority: item.priority ?? 'medium',
    courseId: item.courseId ?? 'general',
    ...item,
  }
  const next = [newDeadline, ...list]
  savePersonalDeadlines(next)
  return newDeadline
}

export function toggleDeadlineCompleted(id: string): void {
  const list = loadPersonalDeadlines()
  const next = list.map((item) =>
    item.id === id ? { ...item, completed: !item.completed } : item,
  )
  savePersonalDeadlines(next)
}

export function deleteDeadline(id: string): void {
  const list = loadPersonalDeadlines()
  const next = list.filter((item) => item.id !== id)
  savePersonalDeadlines(next)
}

export function deadlineDateLabel(iso: string): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
