'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { pullRealtimeSync } from '@/lib/timetable'

export function QuickSyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [memeToast, setMemeToast] = useState<string | null>(null)

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    setMemeToast('Aagu Bro... 🛑 Loading Fresh Data!')

    try {
      await pullRealtimeSync()
    } catch {}

    setTimeout(() => {
      setSyncing(false)
      setMemeToast(null)
    }, 1200)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted active:scale-95 disabled:opacity-50"
        title="Sync live data"
      >
        <RefreshCw className={`size-4 text-primary ${syncing ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Sync</span>
      </button>

      {memeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-4 py-2 text-xs font-bold text-foreground shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <span className="flex size-2 rounded-full bg-primary animate-ping" />
          {memeToast}
        </div>
      )}
    </>
  )
}
