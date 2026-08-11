import type { Transition, Variants } from 'motion/react'

/**
 * Shared animation primitives so the whole app moves with one consistent
 * language. Springs for anything spatial, quick eases for opacity/fades.
 */

export const spring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.9,
}

export const softSpring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
}

export const ease: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
}

/** Container that reveals its children in a gentle stagger. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
}

/** A single item that rises and fades into place. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
}

/** Subtle fade + scale, good for cards and panels. */
export const popItem: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
}

/** Directional slide used when switching weeks. dir: 1 = next, -1 = prev. Optimized for mobile. */
export const weekSlide = {
  enter: (dir: number) => ({
    opacity: 0,
    x: typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : (dir > 0 ? 28 : -28)
  }),
  center: { opacity: 1, x: 0, transition: spring },
  exit: (dir: number) => ({
    opacity: 0,
    x: typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : (dir > 0 ? -28 : 28),
    transition: ease
  }),
}

/** Crossfade with a slight lift, used for top-level tab panels. */
export const tabPanel: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { ...ease, duration: 0.32 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
}
