'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  AlertTriangle,
  Bell,
  BellRing,
  BellOff,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  XCircle,
  Lock,
  Send,
  GraduationCap,
  BookOpen,
} from 'lucide-react'
import {
  allCourseOccurrences,
  ATTENDANCE_CHANGED_EVENT,
  COURSE_ORDER,
  EXCLUDED_COURSES_CHANGED_EVENT,
  getAttendanceLog,
  getAttendanceMetrics,
  getCourseAutoCompletion,
  getExcludedCourses,
  getLockedGroup,
  getStudiedLog,
  LOCKED_GROUP_CHANGED_EVENT,
  setAttendanceStatus,
  STUDIED_LOG_CHANGED_EVENT,
  type AttendanceStatus,
  type CourseId,
  type GroupKey,
} from '@/lib/timetable'
import {
  getScheduleOverrides,
  SCHEDULE_OVERRIDES_CHANGED,
  type ScheduleOverride,
} from '@/lib/schedule-overrides'
import { upcomingEvents } from '@/lib/academic-calendar'
import { cn } from '@/lib/utils'

interface DailyNotificationsProps {
  group: GroupKey
  onOpenSessionManager?: () => void
}

const SOUND_PREF_KEY = 'sst-notif-sound'
const SNOOZE_KEY_PREFIX = 'sst-notif-snooze-'
const DISMISSED_CARDS_KEY = 'sst-notif-dismissed'

export function DailyNotifications({
  group,
  onOpenSessionManager,
}: DailyNotificationsProps) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<Record<string, AttendanceStatus>>({})
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [excluded, setExcluded] = useState<Exclude<CourseId, 'clubs'>[]>([])
  const [lockedGroup, setLockedGroup] = useState<GroupKey | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported')
  const [soundOn, setSoundOn] = useState(true)
  const [dismissedToday, setDismissedToday] = useState<Set<string>>(new Set())
  const [justLogged, setJustLogged] = useState<Set<string>>(new Set())
  const [testToast, setTestToast] = useState<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Service Worker registration, Periodic Sync & Mobile AudioContext unlock on first touch/click
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        if ('periodicSync' in reg) {
          ;(reg.periodicSync as any)
            .register('sst-periodic-sync', {
              minInterval: 12 * 60 * 60 * 1000,
            })
            .catch(() => {})
        }
      }).catch(() => {})
    }

    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume()
        }
      } catch {}
    }

    window.addEventListener('touchstart', unlockAudio, { passive: true })
    window.addEventListener('touchend', unlockAudio, { passive: true })
    window.addEventListener('pointerdown', unlockAudio, { passive: true })
    window.addEventListener('click', unlockAudio, { passive: true })
    return () => {
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('touchend', unlockAudio)
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('click', unlockAudio)
    }
  }, [])

  const showSystemNotification = async (title: string, body: string) => {
    setTestToast(`${title}: ${body}`)
    setTimeout(() => setTestToast(null), 6000)

    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

    const iconUrl = `${window.location.origin}/icon.png`

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: iconUrl,
            badge: iconUrl,
            vibrate: [200, 100, 200, 100, 200],
            tag: 'sst-timetable-alert',
            renotify: true,
          } as any)
          return
        }
      } catch {}
    }

    try {
      new Notification(title, { body, icon: iconUrl })
    } catch {}
  }

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if ('Notification' in window) setPushPermission(Notification.permission)
    try {
      const savedSound = localStorage.getItem(SOUND_PREF_KEY)
      if (savedSound !== null) setSoundOn(savedSound === '1')
      const todayKey = new Date().toDateString()
      const savedDismissed = localStorage.getItem(
        `${DISMISSED_CARDS_KEY}-${todayKey}`,
      )
      if (savedDismissed) setDismissedToday(new Set(JSON.parse(savedDismissed)))
    } catch {}

    const updateLog = () => setLog(getAttendanceLog())
    const updateOverrides = () => setOverrides(getScheduleOverrides())
    const updateEx = () => setExcluded(getExcludedCourses())
    const updateLg = () => setLockedGroup(getLockedGroup())
    updateLog()
    updateOverrides()
    updateEx()
    updateLg()

    window.addEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
    window.addEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
    window.addEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
    window.addEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
    return () => {
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, updateLog)
      window.removeEventListener(SCHEDULE_OVERRIDES_CHANGED, updateOverrides)
      window.removeEventListener(EXCLUDED_COURSES_CHANGED_EVENT, updateEx)
      window.removeEventListener(LOCKED_GROUP_CHANGED_EVENT, updateLg)
    }
  }, [])

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SOUND_PREF_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  const dismissCard = (id: string) => {
    setDismissedToday((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        const todayKey = new Date().toDateString()
        localStorage.setItem(
          `${DISMISSED_CARDS_KEY}-${todayKey}`,
          JSON.stringify(Array.from(next)),
        )
      } catch {}
      return next
    })
  }

  const snoozeReminder = (key: string, minutes: number) => {
    try {
      localStorage.setItem(
        `${SNOOZE_KEY_PREFIX}${key}`,
        String(Date.now() + minutes * 60_000),
      )
    } catch {}
  }

  const isSnoozed = (key: string) => {
    try {
      const until = localStorage.getItem(`${SNOOZE_KEY_PREFIX}${key}`)
      return until ? Date.now() < Number(until) : false
    } catch {
      return false
    }
  }

  const playChime = () => {
    if (!soundOn) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.type = 'sine'
      osc2.type = 'triangle'
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime)
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime)
      osc2.frequency.setValueAtTime(1760, ctx.currentTime + 0.1)

      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)

      osc1.start()
      osc2.start()
      osc1.stop(ctx.currentTime + 0.5)
      osc2.stop(ctx.currentTime + 0.5)
    } catch {}
  }

  const triggerTestNotification = async () => {
    playChime()
    const testMemes = [
      '🔔 Push Notification & Audio Chime Working Perfectly! Parigethu masteru ⚡',
      '⚡ System Push Alert Active! Class reminders will pop 1 hr before class! 🏃‍♂️',
      '⏰ Test Successful! Notifications and Telugu meme alerts are ready! 🚀',
    ]
    const meme = testMemes[Math.floor(Math.random() * testMemes.length)]
    setTestToast(meme)
    setTimeout(() => setTestToast(null), 5000)

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        await showSystemNotification('SST Timetable: Test Alert 🔔', meme)
      } else if (Notification.permission !== 'denied') {
        try {
          const perm = await Notification.requestPermission()
          setPushPermission(perm)
          if (perm === 'granted') {
            await showSystemNotification('SST Timetable: Test Alert 🔔', meme)
          }
        } catch {}
      }
    }
  }

  const quickLog = (key: string, status: AttendanceStatus) => {
    setAttendanceStatus(key, status)
    setJustLogged((prev) => new Set(prev).add(key))
    setTimeout(() => {
      setJustLogged((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 1500)
  }

  const [studiedLog, setStudiedLog] = useState<Record<string, number>>({})

  useEffect(() => {
    const updateStudied = () => setStudiedLog(getStudiedLog())
    updateStudied()
    window.addEventListener(STUDIED_LOG_CHANGED_EVENT, updateStudied)
    return () => window.removeEventListener(STUDIED_LOG_CHANGED_EVENT, updateStudied)
  }, [])

  const todayMsVal = now ? Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) : 0
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0

  const occurrences = useMemo(
    () => allCourseOccurrences(group, overrides, excluded),
    [group, overrides, excluded],
  )

  const upcoming7DayExams = useMemo(() => {
    return upcomingEvents(10, now ?? new Date()).filter(
      (ev) => ev.daysUntil <= 7 && (ev.type === 'end-term' || ev.label.toLowerCase().includes('exam') || ev.label.toLowerCase().includes('eval')),
    )
  }, [now])

  const totalBacklogSessions = useMemo(() => {
    let sum = 0
    COURSE_ORDER.forEach((cId) => {
      const autoComp = getCourseAutoCompletion(cId, group, overrides, now ?? new Date())
      const st = studiedLog[cId] ?? 0
      if (autoComp.held > st) {
        sum += (autoComp.held - st)
      }
    })
    return sum
  }, [group, overrides, now, studiedLog])

  // Background checks for system push notifications (starting / ending / 7-day exam / backlog)
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    )
      return

    const checkAndNotify = () => {
      const nowObj = new Date()
      const todayDateStr = nowObj.toDateString()
      const tMs = Date.UTC(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate())
      const minToday = nowObj.getHours() * 60 + nowObj.getMinutes()

      const hasSent = (key: string) => {
        try {
          return localStorage.getItem(`sst_sent_notif_${key}`) === '1'
        } catch {
          return false
        }
      }

      const markSent = (key: string) => {
        try {
          localStorage.setItem(`sst_sent_notif_${key}`, '1')
        } catch {}
      }

      const upcoming = occurrences.find(
        (o) => o.ms === tMs && o.startMin > minToday && o.startMin - minToday <= 60,
      )
      if (upcoming && !isSnoozed(`start-${upcoming.key}`)) {
        const notifyKey = `start-${upcoming.key}`
        if (!hasSent(notifyKey)) {
          markSent(notifyKey)
          const startMemes = [
            'Inka 1 hour lo class undhi ra bujji! Fast ga ready aipooo 🏃‍♂️',
            'Class time aithondhi guru! Tiffin tini room nundi jaldi bayaludey ⏰',
            'Instructor active aipoyaru! Inka nidra chalu, class ki veldham padhaa ⚡',
            'Attendance meedha aasa unte, inka 1 hour lo class ki vellu masteru 🎒',
            'Sir already slides open chesaru anta! Late aithe door daggare ninchovalsochidhi 🚪',
            'Enni rojulu bunk kodthav? Eeroju aina class ki vellu bro 😴',
            'Class 1 hour lo start avvabothondhi! Tiffins tinesi laptop charging pettuko 💻',
            'Orey badhakam aapu! Inka ganta lo session undhi, fast ga tayar koo ⏱️',
            'Proxy lu nadavavu ikkada! Direct ga physically present avvalsindhe 🔥',
            'Instructor attendance list pattukoni tayar ga unnaru! Parigethu raa 🏃',
            'Class ki 1 hour undhi! Coffee taagi brain refresh chesko ☕',
            'Eeroju class chala important antunnaru! Bunk kotti regret avvaku 📚',
            'Lab session 1 hour lo undhi! Code syntax gurtu techuko bhayya 💻',
            'Gate daggara security strict gaa undhi! Card techuko, class ki ready aipo 🪪',
            'Professor eeroju surprise test pedutharemo! Jaldi class ki vellu 📝',
            'Nee seat vere vaallu kabbja cheyakundaa 1 hour lo pahunchipo 🪑',
            'Inka bed meedhe unnava? Alarm moguthondi bhayya, le le! 🔔',
            'Class miss aithe tarvatha recordings choosthu edavalsosthadi 📼',
            'Arey entraa inka bed digaledhu? Class inka 1 hour lo start ⏰',
            'Good morning hero! Class starting in 1 hour, be ready! ⚡',
          ]
          const meme = startMemes[Math.floor(Math.random() * startMemes.length)]
          playChime()
          showSystemNotification(
            `SST Term 5: ${upcoming.code} Starting in 1 Hour!`,
            `${upcoming.code} starts at ${Math.floor(upcoming.startMin / 60)}:${(upcoming.startMin % 60)
              .toString()
              .padStart(2, '0')} (in 1 hour). ${meme}`,
          )
        }
      }

      const ended = occurrences.find(
        (o) => o.ms === tMs && minToday >= o.endMin && minToday - o.endMin <= 15,
      )
      if (ended && !log[ended.key] && !isSnoozed(`end-${ended.key}`)) {
        const notifyKey = `end-${ended.key}`
        if (!hasSent(notifyKey)) {
          markSent(notifyKey)
          const endMemes = [
            'Class aipoyindhi ra bujji! Present aa Missed aa ventane log chesei 📝',
            'Attend ayyava leda? Log cheyaka pothe direct ga 0% eh bhayya 🔥',
            'Log chesava leda? Emundhi le attendance poyaka edavachu 😴',
            'Professor roll call complete chesaru! Ni status ento ikkada submit cheyi ⚡',
            'Proxy vesi intlo kurchunnav ah? Correct status mark cheyi raa 👀',
            'Session mugisindhi! Timetable lo present ani ticks pettukovayya 🎯',
            'Sarey class aithe aindi, billu nillu avvakunda dashboard lo log cheyi 💸',
            'Attendance log cheyadam marchipothe 80% lechi poddi 📉',
            'Eeroju session lo em ardham aindho notes rasuko, log submit cheyi ✍️',
            'Instructor sign-off ichesaru! Nee attendance status mark chesi relax avvu ☕',
            'Pakkana vaallu present rasukuntunnaru, nuvvu log marchipoyava? 🤦‍♂️',
            'Late cheyakunda single tap tho attendance update chesei 👋',
            'End of class! Time for logging attendance before you grab lunch 🍲',
            'Missed aithe genuine ga Missed kottu, cutoff munde telusthadi ⚠️',
            'Log status saved! Keep tracking your progress daily 🚀',
          ]
          const meme = endMemes[Math.floor(Math.random() * endMemes.length)]
          playChime()
          showSystemNotification(`SST Term 5: ${ended.code} Ended!`, `Log attendance now: ${meme}`)
        }
      }

      // 3. 7-Day Exam Alert Push Notification (once per day)
      const upcomingExams = upcomingEvents(10, nowObj).filter(
        (ev) => ev.daysUntil <= 7 && (ev.type === 'end-term' || ev.label.toLowerCase().includes('exam') || ev.label.toLowerCase().includes('eval')),
      )
      if (upcomingExams.length > 0) {
        const exam = upcomingExams[0]
        const notifyKey = `exam-${exam.date}-${todayDateStr}`
        if (!hasSent(notifyKey) && !isSnoozed(`exam-${exam.date}`)) {
          markSent(notifyKey)
          const examMemes = [
            `Inka ${exam.daysUntil === 0 ? 'eeroju' : exam.daysUntil + ' days lo'} ${exam.label} start! Book open cheyyi raa bujji 📚`,
            `Exam week osthondhi (${exam.label})! All nighterlu and revision start cheyalsina time ⚡`,
            `Orey inka ${exam.daysUntil} days eh undhi ${exam.label} ki! Backlog and syllabus cover chey ☕`,
          ]
          const meme = examMemes[Math.floor(Math.random() * examMemes.length)]
          playChime()
          showSystemNotification(`SST Exam Alert: ${exam.label}`, meme)
        }
      }

      // 4. Backlog Alert Push Notification (once per day)
      const backlogKey = `backlog-alert-${todayDateStr}`
      if (totalBacklogSessions >= 3 && !hasSent(backlogKey)) {
        markSent(backlogKey)
        playChime()
        showSystemNotification(
          'Self-Study Backlog Warning 📚',
          `Mee account lo ${totalBacklogSessions} sessions self-study backlog koodipoyindi masteru! Fast ga Courses tab lo log & review chesei ⚡`,
        )
      }
    }

    const interval = setInterval(checkAndNotify, 20000)
    checkAndNotify()
    return () => clearInterval(interval)
  }, [occurrences, log, soundOn, totalBacklogSessions])

  const todayOccurrences = useMemo(
    () => occurrences.filter((o) => o.ms === todayMsVal),
    [occurrences, todayMsVal],
  )

  const liveSession = useMemo(
    () => todayOccurrences.find((o) => o.startMin <= nowMin && o.endMin > nowMin),
    [todayOccurrences, nowMin],
  )

  const nextSession = useMemo(
    () => todayOccurrences.find((o) => o.startMin > nowMin),
    [todayOccurrences, nowMin],
  )

  const unloggedSessions = useMemo(() => {
    return occurrences.filter(
      (o) =>
        (o.ms < todayMsVal || (o.ms === todayMsVal && o.endMin <= nowMin)) &&
        !log[o.key] &&
        !justLogged.has(o.key),
    )
  }, [occurrences, todayMsVal, nowMin, log, justLogged])

  const upcomingCalEvents = useMemo(() => upcomingEvents(2, now ?? new Date()), [now])

  const allAssessedMetrics = useMemo(
    () => getAttendanceMetrics(group, 'all', log, overrides, now ?? new Date(), excluded),
    [group, log, overrides, now, excluded],
  )

  // Today's logging streak: how many of today's already-ended sessions are logged
  const todayLoggedCount = useMemo(() => {
    const eligible = todayOccurrences.filter((o) => o.endMin <= nowMin)
    if (eligible.length === 0) return null
    const loggedCount = eligible.filter((o) => log[o.key] || justLogged.has(o.key)).length
    return { loggedCount, total: eligible.length }
  }, [todayOccurrences, nowMin, log, justLogged])

  const liveSessionMinsLeft = liveSession ? liveSession.endMin - nowMin : 0

  const urgentCount =
    (liveSession ? 1 : 0) +
    (unloggedSessions.length > 0 && !dismissedToday.has('unlogged') ? 1 : 0) +
    (allAssessedMetrics.isBelow80 && !dismissedToday.has('lowattendance') ? 1 : 0) +
    (upcoming7DayExams.length > 0 && !dismissedToday.has('examalert') ? 1 : 0) +
    (totalBacklogSessions >= 3 && !dismissedToday.has('backlogalert') ? 1 : 0)

  // Web App Badging API: sync unread badge count to PWA app icon on OS home screen
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (urgentCount > 0) {
        navigator.setAppBadge(urgentCount).catch(() => {})
      } else {
        navigator.clearAppBadge().catch(() => {})
      }
    }
  }, [urgentCount])

  const requestPush = async () => {
    if (!('Notification' in window)) return
    playChime()
    const permission = await Notification.requestPermission()
    setPushPermission(permission)
    if (permission === 'granted') {
      await showSystemNotification(
        'Notifications Enabled!',
        'Telugu memes and attendance alerts will be sent here contextually! ⚡',
      )
    }
  }

  const lowAttendanceMeme = useMemo(() => {
    const memes = [
      'Sare paduko emundhi le inka... 80% maintain cheyadam mana valla kadu le 😴',
      'Attendance poyindi masteru! Immediate ga exemption form fill cheyi 📑',
      '80% ledu babu! Intlo chepthe devudaa... Intiki chepala ninnu detention chestharu 💀',
      'Danger zone lo unnav bhayya! Next all classes compulsory attend avvu 🚨',
      'Proxy vesthe dorikipothav! Immediate ga backlog lekunda attendance penchu 🔥',
      'Dean cabin nundi call osthadhemo choosko! Attendance 80% kante thaggindi 📞',
      'Em chesthunnav raa life lo? Minimum 80% lekapothe hall ticket ivvaru 🎫',
      'Bunking masterclass complete chesinattunnav! Attendance red alert lo undhi 🔴',
      'Ippudu cover cheyakapothe end sem lo edavaalsosthadhi 😭',
      'Assessed classes ani skip chesthe safe range zero aipoddi ⚠️',
      'Rey chal, inka bunks aapesey! Attendance floor drop aipoyindi 📉',
      'Calculators and Bunk forecast tool vadu, jaldi recovery plan vesko 🧮',
      'Professor list ready chesthunnaru, nee name top lo undhi lower attendance valla 📋',
      'Emundhi le inka 75% thakkuva unte condonation fee kattuko 💳',
      'Warning bell rang! Clear all unlogged classes and attend next session! 🔔',
    ]
    return memes[Math.floor((now?.getTime() ?? 0) % memes.length)]
  }, [now])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-xs transition hover:bg-muted"
        aria-label="Daily Notifications"
      >
        <Bell className="size-4.5" />
        {urgentCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
            {urgentCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              className="fixed inset-x-3 top-16 z-50 max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-96 sm:max-h-none"
            >
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Daily Context Assistant
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-label={soundOn ? 'Mute chimes' : 'Unmute chimes'}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
                {/* 1. Live Session */}
                {liveSession && (
                  <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-primary">
                      <span className="flex items-center gap-1.5">
                        <Flame className="size-4 animate-bounce" /> Live Session Now
                      </span>
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {liveSessionMinsLeft}m left
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">
                      {liveSession.code}: {liveSession.courseName}
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.max(
                            4,
                            100 -
                              (liveSessionMinsLeft /
                                Math.max(1, liveSession.endMin - liveSession.startMin)) *
                                100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] italic font-semibold text-primary">
                      &quot;Class live nadustondi masteru! Parigethu, proxy lu work avvav ikkada 🏃‍♂️&quot;
                    </p>
                  </div>
                )}

                {/* 2. Today's Overview + streak */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-primary" /> Today&apos;s Schedule
                    </span>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      {lockedGroup === group && <Lock className="size-2.5 text-primary" />}
                      Group {group}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {todayOccurrences.length > 0 ? (
                      <>
                        You have <strong>{todayOccurrences.length} session{todayOccurrences.length === 1 ? '' : 's'}</strong> today ({todayOccurrences.map((o) => o.code).join(', ')}).
                      </>
                    ) : (
                      'No classes scheduled for today. Enjoy your day!'
                    )}
                  </p>
                  {todayLoggedCount && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            todayLoggedCount.loggedCount === todayLoggedCount.total
                              ? 'bg-emerald-500'
                              : 'bg-amber-500',
                          )}
                          style={{
                            width: `${(todayLoggedCount.loggedCount / todayLoggedCount.total) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {todayLoggedCount.loggedCount}/{todayLoggedCount.total} logged
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Next Session */}
                {nextSession && !liveSession && (
                  <div className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Clock className="size-3.5 text-primary" /> Next Up Today
                    </div>
                    <p className="font-semibold text-foreground">
                      {nextSession.code} · {nextSession.courseName}
                    </p>
                    <p className="text-muted-foreground">
                      Starts at {Math.floor(nextSession.startMin / 60)}:
                      {(nextSession.startMin % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                )}

                {/* 4. Unlogged Sessions — with quick-log actions */}
                {unloggedSessions.length > 0 && !dismissedToday.has('unlogged') && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="size-3.5" /> Pending Attendance Logs
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissCard('unlogged')}
                        className="text-amber-600/70 hover:text-amber-700 dark:text-amber-400/70"
                        aria-label="Dismiss"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-muted-foreground">
                      {unloggedSessions.length} completed session{unloggedSessions.length === 1 ? '' : 's'} awaiting attendance mark.
                    </p>
                    <div className="space-y-1.5">
                      {unloggedSessions.slice(0, 3).map((s) => (
                        <div
                          key={s.key}
                          className="flex items-center justify-between rounded-lg bg-background/70 px-2 py-1.5"
                        >
                          <span className="font-semibold text-foreground">{s.code}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => quickLog(s.key, 'present')}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="size-3" /> Present
                            </button>
                            <button
                              type="button"
                              onClick={() => quickLog(s.key, 'missed')}
                              className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive hover:bg-destructive/25"
                            >
                              <XCircle className="size-3" /> Missed
                            </button>
                            <button
                              type="button"
                              onClick={() => snoozeReminder(`end-${s.key}`, 30)}
                              aria-label="Snooze reminder 30 minutes"
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                            >
                              <BellOff className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {unloggedSessions.length > 3 && onOpenSessionManager && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false)
                            onOpenSessionManager()
                          }}
                          className="w-full text-center text-[10px] font-bold text-amber-700 underline dark:text-amber-300"
                        >
                          +{unloggedSessions.length - 3} more — open session manager
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] italic font-semibold text-amber-700 dark:text-amber-300">
                      &quot;Class aipoyindi ra bujji! Ventane log chesei 📝&quot;
                    </p>
                  </div>
                )}

                {/* 5. Attendance Floor Alert */}
                {allAssessedMetrics.isBelow80 && !dismissedToday.has('lowattendance') && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5 animate-bounce" /> Low Attendance Warning
                      </p>
                      <button
                        type="button"
                        onClick={() => dismissCard('lowattendance')}
                        className="text-destructive/70 hover:text-destructive"
                        aria-label="Dismiss"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <p className="opacity-95 text-foreground font-semibold">
                      &quot;{lowAttendanceMeme}&quot;
                    </p>
                    <p className="opacity-90">
                      Your overall attendance is currently {allAssessedMetrics.attendancePercentage}%. Missed {allAssessedMetrics.alreadyMissed} of {allAssessedMetrics.maxAllowedMisses} allowed misses.
                    </p>
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLSehkGVzY57bYg4gFMU912d1pRlajHUJtnsuy9gPLHP0UDZh4Q/viewform"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-destructive px-2.5 py-1.5 text-[11px] font-bold text-destructive-foreground transition hover:brightness-115 active:scale-95"
                    >
                      <FileText className="size-3.5" />
                      Attendance Appeal / Exemption Form
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}

                {/* 6. Upcoming Calendar Events */}
                {upcomingCalEvents.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                    <p className="font-bold text-foreground">Academic Events</p>
                    {upcomingCalEvents.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between text-muted-foreground">
                        <span>{ev.label}</span>
                        <span className="font-semibold text-foreground">{ev.daysUntil === 0 ? 'Today' : `in ${ev.daysUntil}d`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border bg-muted/40 p-3 text-center">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={requestPush}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline active:scale-95"
                  >
                    {pushPermission === 'granted' ? (
                      <>
                        <BellRing className="size-3.5 text-primary animate-pulse" /> Push Alerts Active
                      </>
                    ) : (
                      <>
                        <Bell className="size-3.5" /> Enable Live Push Alerts & Memes
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={triggerTestNotification}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition hover:bg-primary/20 active:scale-95"
                    title="Send a test notification & sound chime to verify browser permissions"
                  >
                    <Send className="size-3" /> Test Push Alert
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating In-App Test Notification Toast */}
      <AnimatePresence>
        {testToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BellRing className="size-5 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground">Notification Test Active</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{testToast}</p>
            </div>
            <button
              type="button"
              onClick={() => setTestToast(null)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
