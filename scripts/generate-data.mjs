import { read, utils } from 'xlsx'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const buf = readFileSync('data/SST-2029-Batch-Term-5-Syllabus-b19878.xlsx')
const wb = read(buf, { cellDates: true })

const SCHEDULE = 'Aug26-Oct26 Weekly Schedule'
const schedSheet = wb.Sheets[SCHEDULE]
const rows = utils.sheet_to_json(schedSheet, { header: 1, raw: false, defval: '' })
const merges = schedSheet['!merges'] || []

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const GROUPS = {
  A: { label: 'Group A', cols: [2, 3, 4, 5, 6, 7] },
  B: { label: 'Group B', cols: [9, 10, 11, 12, 13, 14] },
  C: { label: 'Group C', cols: [16, 17, 18, 19, 20, 21] },
}

const FIRST_ROW = 2 // 9:00 AM
const LAST_ROW = 44 // 7:30 PM (start of last slot)
const START_MIN = 9 * 60

// Row -> start minutes since midnight (contiguous 15-min slots)
const rowStart = (r) => START_MIN + (r - FIRST_ROW) * 15

function minToLabel(m) {
  let h = Math.floor(m / 60)
  const mm = m % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}:${mm.toString().padStart(2, '0')} ${ampm}`
}

// Course metadata: prefix -> info
const COURSES = {
  CML: {
    id: 'cml',
    code: 'CML',
    name: 'Classical Machine Learning',
    color: 'violet',
    sheet: wb.SheetNames.find((n) => n.includes('Classical Machine')),
  },
  MERN: {
    id: 'mern',
    code: 'MERN',
    name: 'Building Web Applications',
    color: 'emerald',
    sheet: wb.SheetNames.find((n) => n.includes('Building Web')),
  },
  CN: {
    id: 'cn',
    code: 'CN',
    name: 'Computer Networks',
    color: 'amber',
    sheet: wb.SheetNames.find((n) => n.includes('Computer Networks')),
  },
  FDSA: {
    id: 'fdsa',
    code: 'FDSA',
    name: 'FDSA Repeat',
    color: 'rose',
    sheet: wb.SheetNames.find((n) => n.includes('FDSA')),
  },
  Academic: {
    id: 'clubs',
    code: 'Clubs',
    name: 'Academic Clubs',
    color: 'sky',
    sheet: null,
  },
}

function courseFromCode(firstLine) {
  const s = firstLine.toLowerCase()
  if (s.startsWith('cml')) return COURSES.CML
  if (s.startsWith('mern')) return COURSES.MERN
  if (s.startsWith('cn')) return COURSES.CN
  if (s.startsWith('fdsa')) return COURSES.FDSA
  if (s.startsWith('academic')) return COURSES.Academic
  return null
}

function parseCell(raw) {
  const text = raw.trim()
  if (!text) return null
  if (text.toLowerCase() === 'lunch') return { type: 'break', title: 'Lunch' }
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const course = courseFromCode(lines[0])
  const isLab = /\blab\b/i.test(text)
  // faculty is the line wrapped in parentheses
  let faculty = ''
  const facLine = lines.find((l) => /\(.*\)/.test(l))
  if (facLine) faculty = facLine.replace(/[()]/g, '').trim()
  // group descriptor line (e.g. "Grp A", "Grp B LAB")
  const grpLine = lines.find((l) => /^grp/i.test(l)) || ''
  // room = last line that isn't code, group, or faculty
  const used = new Set([lines[0], facLine, grpLine].filter(Boolean))
  const roomLine = [...lines].reverse().find((l) => !used.has(l)) || ''
  return {
    type: 'class',
    courseId: course ? course.id : 'other',
    courseName: course ? course.name : lines[0],
    code: course ? course.code : lines[0],
    color: course ? course.color : 'slate',
    isLab,
    faculty,
    room: roomLine,
    raw: text,
  }
}

// For a given column, map top-row -> end-row using vertical merges,
// and mark covered rows so we don't double count.
function columnSpans(col) {
  const topToEnd = new Map()
  const covered = new Set()
  for (const m of merges) {
    if (m.s.c === col && m.s.r >= FIRST_ROW && m.s.r <= LAST_ROW && m.e.r >= m.s.r) {
      topToEnd.set(m.s.r, m.e.r)
      for (let r = m.s.r; r <= m.e.r; r++) covered.add(r)
    }
  }
  return { topToEnd, covered }
}

// Build merged events per group using merge spans (durations come from merges,
// since a multi-slot class is a single merged cell with value only in the top row).
function buildEvents(cols) {
  const events = []
  cols.forEach((col, di) => {
    const day = DAYS[di]
    const { topToEnd, covered } = columnSpans(col)
    for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
      const raw = (rows[r]?.[col] || '').toString().trim()
      // Skip rows that are part of a merge but not its top row
      if (covered.has(r) && !topToEnd.has(r)) continue
      if (!raw) continue
      const endRow = topToEnd.get(r) ?? r
      const parsed = parseCell(raw)
      if (!parsed) continue
      const startMin = rowStart(r)
      const endMin = rowStart(endRow) + 15
      events.push({
        id: `${day}-${col}-${r}`,
        day,
        dayIndex: di,
        startMin,
        endMin,
        startLabel: minToLabel(startMin),
        endLabel: minToLabel(endMin),
        durationMin: endMin - startMin,
        ...parsed,
      })
    }
  })
  return events.sort((a, b) => a.dayIndex - b.dayIndex || a.startMin - b.startMin)
}

const eventsByGroup = {}
for (const [key, g] of Object.entries(GROUPS)) {
  eventsByGroup[key] = buildEvents(g.cols)
}

// Parse syllabus sheets
function parseSyllabus(sheetName) {
  if (!sheetName) return { sessions: [], evaluations: [] }
  const s = utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' })
  const sessions = []
  const evaluations = []
  for (let i = 1; i < s.length; i++) {
    const row = s[i]
    const num = (row[0] || '').toString().trim()
    const title = (row[1] || '').toString().trim()
    const topics = (row[2] || '').toString().trim()
    const assignments = (row[3] || '').toString().trim()
    if (title) {
      sessions.push({
        number: num,
        title,
        topics: topics
          ? topics.split('\n').map((t) => t.trim()).filter(Boolean)
          : [],
        assignments,
      })
    }
    // evaluation columns: 6 = component, 9 = weightage, 10 = comments
    const evalComp = (row[6] || '').toString().trim()
    const weightage = (row[9] || '').toString().trim()
    const comments = (row[10] || '').toString().trim()
    if (evalComp && evalComp.toLowerCase() !== 'course credits:') {
      evaluations.push({ component: evalComp, weightage, comments })
    }
  }
  return { sessions, evaluations }
}

const courses = {}
for (const c of Object.values(COURSES)) {
  const { sessions, evaluations } = parseSyllabus(c.sheet)
  courses[c.id] = {
    id: c.id,
    code: c.code,
    name: c.name,
    color: c.color,
    sessions,
    evaluations,
  }
}

const timeRange = { startMin: rowStart(FIRST_ROW), endMin: rowStart(LAST_ROW) + 15 }

const out = {
  meta: {
    term: 'Term 5',
    batch: 'SST 2029 Batch',
    period: 'Aug 2026 – Oct 2026',
    days: DAYS,
    groups: Object.fromEntries(Object.entries(GROUPS).map(([k, v]) => [k, v.label])),
    timeRange,
  },
  courses,
  eventsByGroup,
}

mkdirSync('lib', { recursive: true })
writeFileSync('lib/timetable-data.json', JSON.stringify(out, null, 2))

// quick summary
console.log('Groups:', Object.keys(eventsByGroup))
for (const [k, ev] of Object.entries(eventsByGroup)) {
  console.log(`  Group ${k}: ${ev.length} events`)
}
console.log('Courses:', Object.values(courses).map((c) => `${c.code}(${c.sessions.length} sessions)`).join(', '))
console.log('Sample events (A):')
console.log(eventsByGroup.A.filter((e) => e.type === 'class').slice(0, 6))
