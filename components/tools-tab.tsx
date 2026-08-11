'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookMarked,
  Calculator,
  Check,
  Database,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import {
  ATTENDANCE_CHANGED_EVENT,
  attendanceTotals,
  COURSE_ORDER,
  courseOccurrences,
  EXCLUDED_COURSES_CHANGED_EVENT,
  exportCalendarIcal,
  exportDashboardData,
  generateSyncUrl,
  getAttendanceLog,
  getAttendanceMetrics,
  getExcludedCourses,
  getSyncCode,
  importDashboardData,
  pullRealtimeSync,
  pushRealtimeSync,
  saveSyncCode,
  timetable,
  type AttendanceStatus,
  type CourseId,
  type GroupKey,
} from '@/lib/timetable'
import {
  getScheduleOverrides,
  SCHEDULE_OVERRIDES_CHANGED,
  type ScheduleOverride,
} from '@/lib/schedule-overrides'
import { cn } from '@/lib/utils'

interface SavedLink {
  id: string
  title: string
  url: string
}
interface PinnedPdf {
  id: string
  name: string
  dataUrl: string
}
const LINK_STORE_KEY = 'academic-dashboard-important-links'
const PDF_STORE_KEY = 'academic-dashboard-pinned-pdfs'

const DEFAULT_SHORTCUTS: SavedLink[] = [
  { id: '1', title: 'Scaler Portal', url: 'https://www.scaler.com/hire/test/' },
  { id: '2', title: 'GitHub', url: 'https://github.com' },
  { id: '3', title: 'Google Classroom', url: 'https://classroom.google.com' },
  { id: '4', title: 'ChatGPT', url: 'https://chatgpt.com' },
]

const GRADE_TARGET_STORE_KEY = 'academic-dashboard-grade-target'

export function ToolsTab({ group }: { group: GroupKey }) {
  const [courseId, setCourseId] = useState<CourseId | 'all'>('all')
  const [attended, setAttended] = useState<number | null>(null)
  const [log, setLog] = useState<Record<string, AttendanceStatus>>({})
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [excluded, setExcluded] = useState<Exclude<CourseId, 'clubs'>[]>([])
  const [links, setLinks] = useState<SavedLink[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [pdfs, setPdfs] = useState<PinnedPdf[]>([])
  const [earned, setEarned] = useState(0)
  const [possible, setPossible] = useState(100)
  const [target, setTarget] = useState(80)
  const [simulatedBunks, setSimulatedBunks] = useState(0)

  const reloadToolsData = () => {
    try {
      const saved = window.localStorage.getItem(LINK_STORE_KEY)
      if (saved) {
        setLinks(JSON.parse(saved) as SavedLink[])
      } else {
        setLinks(DEFAULT_SHORTCUTS)
        window.localStorage.setItem(LINK_STORE_KEY, JSON.stringify(DEFAULT_SHORTCUTS))
      }
      const savedPdfs = window.localStorage.getItem(PDF_STORE_KEY)
      if (savedPdfs) setPdfs(JSON.parse(savedPdfs) as PinnedPdf[])
      const savedGrade = window.localStorage.getItem(GRADE_TARGET_STORE_KEY)
      if (savedGrade) {
        const parsed = JSON.parse(savedGrade)
        if (parsed.earned !== undefined) setEarned(parsed.earned)
        if (parsed.possible !== undefined) setPossible(parsed.possible)
        if (parsed.target !== undefined) setTarget(parsed.target)
      }
    } catch {
      /* Local storage may be unavailable */
    }
  }

  useEffect(() => {
    reloadToolsData()
  }, [])

  useEffect(() => {
    const updateLog = () => setLog(getAttendanceLog())
    const updateOverrides = () => setOverrides(getScheduleOverrides())
    const updateEx = () => setExcluded(getExcludedCourses())
    const updateTools = () => reloadToolsData()
    updateLog()
    updateOverrides()
    updateEx()

    window.addEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
    window.addEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
    window.addEventListener('academic-dashboard-tools-changed', updateTools)
    return () => {
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
      window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
      window.removeEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
      window.removeEventListener('academic-dashboard-tools-changed', updateTools)
    }
  }, [])

  const metrics = useMemo(
    () => getAttendanceMetrics(group, courseId, log, overrides, new Date(), excluded),
    [courseId, group, log, overrides, excluded],
  )

  const effectiveAttended = attended !== null ? attended : metrics.attended
  const safeAttended = Math.min(Math.max(effectiveAttended, 0), metrics.totalClasses)
  const percentage = metrics.totalClasses
    ? Math.round((safeAttended / metrics.totalClasses) * 100)
    : 0
  const requiredForTarget = Math.max(0, Math.ceil((possible * target) / 100) - earned)

  const persistLinks = (next: SavedLink[]) => {
    setLinks(next)
    window.localStorage.setItem(LINK_STORE_KEY, JSON.stringify(next))
    pushRealtimeSync()
  }

  const updateGradeTarget = (newEarned: number, newPossible: number, newTarget: number) => {
    setEarned(newEarned)
    setPossible(newPossible)
    setTarget(newTarget)
    window.localStorage.setItem(
      GRADE_TARGET_STORE_KEY,
      JSON.stringify({ earned: newEarned, possible: newPossible, target: newTarget }),
    )
    pushRealtimeSync()
  }

  const addLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!linkTitle.trim() || !linkUrl.trim()) return
    const next = [
      ...links,
      { id: crypto.randomUUID(), title: linkTitle.trim(), url: linkUrl.trim() },
    ]
    persistLinks(next)
    setLinkTitle('')
    setLinkUrl('')
    setShowAddModal(false)
  }

  const pinPdf = (file: File | undefined) => {
    if (!file || file.type !== 'application/pdf' || file.size > 1_500_000) return
    const reader = new FileReader()
    reader.onload = () => {
      const next = [
        ...pdfs,
        { id: crypto.randomUUID(), name: file.name, dataUrl: String(reader.result) },
      ]
      setPdfs(next)
      window.localStorage.setItem(PDF_STORE_KEY, JSON.stringify(next))
      pushRealtimeSync()
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* 80% Attendance Planner */}
      <ToolCard
        icon={ShieldCheck}
        title="80% attendance planner"
        subtitle="Sessions + labs only. Clubs are excluded."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <label className="text-xs font-semibold text-muted-foreground">
            Course
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value as CourseId | 'all')
                setAttended(null)
              }}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All assessed courses</option>
              {COURSE_ORDER.map((id) => (
                <option key={id} value={id}>
                  {timetable.courses[id].code} · {timetable.courses[id].name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Classes attended
            <input
              min="0"
              max={metrics.totalClasses}
              value={effectiveAttended}
              onChange={(e) => setAttended(Number(e.target.value))}
              type="number"
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Metric value={String(metrics.totalClasses)} label="total classes" />
          <Metric value={String(metrics.alreadyMissed)} label="already missed" />
          <Metric value={String(metrics.canStillMiss)} label="can still miss" />
          <Metric
            value={`${percentage}%`}
            label="your attendance"
            emphasis={percentage >= 80}
          />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {metrics.sessions} syllabus sessions + {metrics.labs} labs · Already missed{' '}
          <strong className="text-foreground">{metrics.alreadyMissed}</strong> · Can still
          miss <strong className="text-foreground">{metrics.canStillMiss}</strong> class
          {metrics.canStillMiss === 1 ? '' : 'es'} of {metrics.maxAllowedMisses} total
          allowed.
        </p>

        {/* What-If Attendance Simulator */}
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" /> What-If Bunk Simulator
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Simulate future classes
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground font-medium">
              If I skip <strong className="text-primary font-bold">{simulatedBunks}</strong> more upcoming class{simulatedBunks === 1 ? '' : 'es'}:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSimulatedBunks(Math.max(0, simulatedBunks - 1))}
                className="size-7 rounded-lg border border-border bg-background text-xs font-bold text-foreground hover:bg-muted active:scale-95 flex items-center justify-center"
              >
                -
              </button>
              <span className="w-6 text-center text-xs font-bold tabular-nums">
                {simulatedBunks}
              </span>
              <button
                type="button"
                onClick={() => setSimulatedBunks(simulatedBunks + 1)}
                className="size-7 rounded-lg border border-border bg-background text-xs font-bold text-foreground hover:bg-muted active:scale-95 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-background/80 px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">Projected Misses: <strong className="text-foreground">{metrics.alreadyMissed + simulatedBunks} / {metrics.maxAllowedMisses}</strong></span>
            <span className={cn('font-bold', (metrics.canStillMiss - simulatedBunks) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
              {(metrics.canStillMiss - simulatedBunks) >= 0
                ? `🟢 Safe (${metrics.canStillMiss - simulatedBunks} left)`
                : `🔴 Below 80% (${Math.abs(metrics.canStillMiss - simulatedBunks)} over limit)`}
            </span>
          </div>
        </div>
      </ToolCard>

      {/* Chrome-Style Shortcuts Menu */}
      <ToolCard
        icon={Globe}
        title="Web Shortcuts"
        subtitle="Chrome-style quick access menu to your portal, docs, & resources."
      >
        {/* Shortcuts Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {links.map((link) => (
            <ChromeShortcutTile
              key={link.id}
              title={link.title}
              url={link.url}
              onDelete={() => persistLinks(links.filter((item) => item.id !== link.id))}
            />
          ))}

          {/* Add Shortcut Card */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="group flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-3.5 text-center transition hover:border-primary hover:bg-primary/5"
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-dashed border-border bg-background text-muted-foreground transition group-hover:border-primary group-hover:text-primary">
              <Plus className="size-5" />
            </div>
            <span className="mt-2 text-xs font-semibold text-muted-foreground group-hover:text-primary">
              Add shortcut
            </span>
          </button>
        </div>

        {/* Add Shortcut Modal Form */}
        {showAddModal && (
          <form
            onSubmit={addLink}
            className="mt-4 rounded-2xl border border-border bg-muted/40 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground">New Shortcut</h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Shortcut Name (e.g. Scaler Portal)"
                required
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
              />
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="URL (e.g. https://...)"
                required
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:brightness-95"
            >
              <Plus className="size-3.5" /> Save Shortcut
            </button>
          </form>
        )}

        {/* Pinned PDFs section */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <FileText className="size-4 text-primary" /> Pinned PDFs
              </p>
              <p className="text-[11px] text-muted-foreground">
                Stored privately in this browser · max 1.5 MB each
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary">
              <Upload className="size-3.5" /> Pin PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => pinPdf(event.target.files?.[0])}
                className="sr-only"
              />
            </label>
          </div>
          {pdfs.length > 0 && (
            <div className="mt-2 space-y-2">
              {pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex max-w-full items-center justify-between gap-2.5 overflow-hidden rounded-xl border border-border bg-muted/20 p-2.5"
                >
                  <FileText className="size-4 shrink-0 text-primary" />
                  <a
                    href={pdf.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={pdf.name}
                    className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground hover:text-primary sm:text-sm"
                  >
                    {pdf.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const next = pdfs.filter((item) => item.id !== pdf.id)
                      setPdfs(next)
                      window.localStorage.setItem(PDF_STORE_KEY, JSON.stringify(next))
                      pushRealtimeSync()
                    }}
                    aria-label={`Remove ${pdf.name}`}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive active:scale-95"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ToolCard>

      {/* Cross-Browser Data Backup & Sync Card */}
      <ToolCard
        icon={Database}
        title="Cross-browser sync & data backup"
        subtitle="Sync or backup your attendance logs, shortcuts, and settings instantly."
      >
        <SyncBackupControls />
      </ToolCard>

      {/* iCal / Google Calendar Export Card */}
      <ToolCard
        icon={Download}
        title="Sync to Phone / Google Calendar"
        subtitle={`Export Group ${group} weekly schedule as a standard .ics iCalendar file.`}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Download your Group {group} weekly timetable into Google Calendar, Apple Calendar, or Outlook to get automated reminders on your phone before every class.
          </p>
          <button
            type="button"
            onClick={() => exportCalendarIcal(group)}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-95"
          >
            <Download className="size-4" />
            Download Group {group} iCal (.ics) Calendar
          </button>
        </div>
      </ToolCard>

      {/* Semester Snapshot */}
      <ToolCard
        icon={BarChart3}
        title="Semester snapshot"
        subtitle="A fast, practical view of your current plan."
      >
        <div className="grid grid-cols-2 gap-3">
          <Metric value={String(metrics.sessions)} label="planned sessions" />
          <Metric value={String(metrics.labs)} label="planned labs" />
          <Metric value={String(metrics.totalClasses)} label="assessed classes" />
          <Metric value="80%" label="attendance floor" emphasis />
        </div>
      </ToolCard>
    </div>
  )
}

function SyncBackupControls() {
  const [syncCodeInput, setSyncCodeInput] = useState('')
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [syncingNow, setSyncingNow] = useState(false)

  useEffect(() => {
    const code = getSyncCode()
    setActiveCode(code)
    if (code) setSyncCodeInput(code)
  }, [])

  const handleSetSyncCode = (codeToSave: string | null) => {
    saveSyncCode(codeToSave)
    setActiveCode(codeToSave)
    if (codeToSave) {
      setStatus(`⚡ Live Real-Time Sync ACTIVE for Code "${codeToSave}". Any changes on Phone or Web sync automatically!`)
    } else {
      setSyncCodeInput('')
      setStatus('Live Real-Time Sync disabled.')
    }
  }

  const generateRandomCode = () => {
    const num = Math.floor(1000 + Math.random() * 9000)
    const code = `SST-${num}`
    setSyncCodeInput(code)
    handleSetSyncCode(code)
  }

  const handleManualSyncNow = async () => {
    setSyncingNow(true)
    await pushRealtimeSync()
    const pulled = await pullRealtimeSync()
    setSyncingNow(false)
    setStatus(pulled ? 'Synced latest attendance data from live cloud!' : 'Pushed latest attendance data!')
  }

  const handleExport = () => {
    const data = exportDashboardData()
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sst-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus('Exported backup successfully!')
  }

  const handleImport = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        const success = importDashboardData(data)
        if (success) {
          setStatus('Data imported & restored successfully!')
        } else {
          setStatus('Import failed. Invalid backup file format.')
        }
      } catch {
        setStatus('Error reading backup JSON file.')
      }
    }
    reader.readAsText(file)
  }

  const handleCopySyncLink = () => {
    const url = generateSyncUrl()
    if (url) {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setStatus('Sync link copied! Open this URL in any browser/device to transfer data.')
      setTimeout(() => setCopied(false), 3000)
    }
  }

  return (
    <div className="space-y-4">
      {/* Real-Time Live Sync Box */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Zap className="size-4 animate-pulse text-primary" />
            Live Real-Time Device Sync (Phone ↔ Laptop)
          </span>
          {activeCode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
              Live Connected ({activeCode})
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Enter a code (e.g. <code>SST-4821</code>) on both devices. Changes sync automatically in real time!
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={syncCodeInput}
            onChange={(e) => setSyncCodeInput(e.target.value.toUpperCase())}
            placeholder="e.g. SST-4821 or 7777"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSetSyncCode(syncCodeInput.trim() || null)}
              className="inline-flex h-10 flex-1 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs transition hover:brightness-95 active:scale-95 sm:flex-none"
            >
              {activeCode === syncCodeInput.trim().toUpperCase() && activeCode ? 'Update Code' : 'Connect Code'}
            </button>
            <button
              type="button"
              onClick={generateRandomCode}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary/50 transition active:scale-95"
              title="Generate random 4-digit code"
            >
              Generate Code
            </button>
          </div>
        </div>

        {activeCode && (
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleManualSyncNow}
              disabled={syncingNow}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              <RefreshCw className={cn('size-3', syncingNow && 'animate-spin')} />
              Force Sync Now
            </button>

            <button
              type="button"
              onClick={() => handleSetSyncCode(null)}
              className="text-[11px] font-medium text-destructive hover:underline"
            >
              Disconnect Sync Code
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition"
        >
          <Download className="size-4 text-primary" />
          Export Backup (.json)
        </button>

        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition">
          <Upload className="size-4 text-primary" />
          Import Backup File
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => handleImport(e.target.files?.[0])}
            className="sr-only"
          />
        </label>

        <button
          type="button"
          onClick={handleCopySyncLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition"
        >
          {copied ? <Check className="size-4 text-emerald-500" /> : <Share2 className="size-4 text-primary" />}
          {copied ? 'Copied Link!' : 'Copy Sync Link'}
        </button>
      </div>

      {status && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {status}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        🔒 All attendance data and group settings are kept 100% private in local storage. Use <strong>Live Real-Time Sync Code</strong> to keep your Phone (Chrome) and Laptop (Zen/Chrome) in sync automatically.
      </p>
    </div>
  )
}

function ChromeShortcutTile({
  title,
  url,
  onDelete,
}: {
  title: string
  url: string
  onDelete: () => void
}) {
  const [imgError, setImgError] = useState(false)

  const domain = useMemo(() => {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`)
      return u.hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }, [url])

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  const firstLetter = title.trim().charAt(0).toUpperCase() || 'L'

  return (
    <a
      href={url.startsWith('http') ? url : `https://${url}`}
      target="_blank"
      rel="noreferrer"
      className="group relative flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card p-3.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-2 right-2 rounded-lg p-1 text-muted-foreground opacity-100 transition hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        title="Remove shortcut"
      >
        <Trash2 className="size-3.5" />
      </button>

      <div className="flex size-12 items-center justify-center rounded-full bg-muted/80 font-bold text-primary text-base shadow-xs overflow-hidden border border-border/60 transition group-hover:bg-primary/10">
        {!imgError ? (
          <img
            src={faviconUrl}
            alt=""
            onError={() => setImgError(true)}
            className="size-6 object-contain"
          />
        ) : (
          <span>{firstLetter}</span>
        )}
      </div>

      <p className="mt-2.5 max-w-full truncate text-xs font-semibold text-foreground">
        {title}
      </p>
      <p className="max-w-full truncate text-[10px] text-muted-foreground">{domain}</p>
    </a>
  )
}

function ToolCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof ShieldCheck
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Metric({
  value,
  label,
  emphasis,
}: {
  value: string
  label: string
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-xl px-2 py-3 ${emphasis ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'}`}
    >
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p
        className={`text-[10px] font-medium ${emphasis ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
      >
        {label}
      </p>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="text-[11px] font-semibold text-muted-foreground">
      {label}
      <input
        value={value}
        min="0"
        onChange={(e) => onChange(Number(e.target.value))}
        type="number"
        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  )
}
