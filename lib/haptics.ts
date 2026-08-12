'use client'

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

/**
 * Trigger subtle, tactile Web Vibration API feedback on supported mobile devices.
 * Gracefully degrades on unsupported browsers/desktop.
 */
export function triggerHaptic(pattern: HapticPattern = 'light'): void {
  if (typeof window === 'undefined' || !('navigator' in window) || !('vibrate' in navigator)) {
    return
  }

  try {
    switch (pattern) {
      case 'light':
        navigator.vibrate(10)
        break
      case 'medium':
        navigator.vibrate(25)
        break
      case 'heavy':
        navigator.vibrate(45)
        break
      case 'success':
        navigator.vibrate([12, 25, 15])
        break
      case 'warning':
        navigator.vibrate([35, 40, 35])
        break
      case 'error':
        navigator.vibrate([50, 30, 50, 30, 50])
        break
    }
  } catch {}
}
