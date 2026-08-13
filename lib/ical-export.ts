import { timetable, WEEKS } from './timetable'
import { loadPersonalDeadlines } from './personal-deadlines'
import { getScheduleOverrides } from './schedule-overrides'
import { blockedDayMs } from './academic-calendar'

export function generateICSFile(group: 'A' | 'B' | 'C' = 'A'): string {
  const events: string[] = []
  const overrides = getScheduleOverrides()
  const cancelKeys = new Set(
    overrides.filter((o) => o.type === 'cancel' || o.type === 'reschedule').map((o) => o.originalKey),
  )

  const groupEvents = timetable.eventsByGroup[group] ?? []

  // Add standard timetable class slots
  for (const week of WEEKS) {
    for (const event of groupEvents) {
      if (event.type !== 'class') continue
      const cell = week.days[event.dayIndex]
      if (!cell || !cell.inTerm || blockedDayMs.has(cell.ms)) continue

      const key = `${event.id}|${week.index}`
      if (cancelKeys.has(key)) continue

      const d = new Date(cell.ms)
      const startMin = event.startMin
      const endMin = event.endMin

      const startHours = Math.floor(startMin / 60)
      const startMins = startMin % 60
      const endHours = Math.floor(endMin / 60)
      const endMins = endMin % 60

      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')

      const dtStart = `${year}${month}${day}T${String(startHours).padStart(2, '0')}${String(startMins).padStart(2, '0')}00Z`
      const dtEnd = `${year}${month}${day}T${String(endHours).padStart(2, '0')}${String(endMins).padStart(2, '0')}00Z`

      events.push(
        [
          'BEGIN:VEVENT',
          `UID:sst-class-${key}@scaler.sst`,
          `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:[SST Term 5] ${event.courseName} (${event.code})`,
          `DESCRIPTION:Faculty: ${event.faculty || 'SST Faculty'} | Room: ${event.room || 'SST Campus'}`,
          `LOCATION:${event.room || 'Scaler Campus'}`,
          'STATUS:CONFIRMED',
          'END:VEVENT',
        ].join('\r\n'),
      )
    }
  }

  // Add personal deadlines
  const deadlines = loadPersonalDeadlines()
  for (const dl of deadlines) {
    if (!dl.date) continue
    const [y, m, d] = dl.date.split('-')
    if (!y || !m || !d) continue

    const dtStart = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}T090000Z`
    const dtEnd = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}T100000Z`

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:sst-deadline-${dl.id}@scaler.sst`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:🚩 [Deadline] ${dl.title}`,
        `DESCRIPTION:Note: ${dl.note || 'No notes'} | Priority: ${dl.priority || 'medium'}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ].join('\r\n'),
    )
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scaler School of Technology//Term 5 Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Scaler SST Term 5 Timetable & Deadlines',
    'X-WR-TIMEZONE:Asia/Kolkata',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadICSFile(group: 'A' | 'B' | 'C' = 'A') {
  const icsContent = generateICSFile(group)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `SST_Term5_Timetable_Group_${group}.ics`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
