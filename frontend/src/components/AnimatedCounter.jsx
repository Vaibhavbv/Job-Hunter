import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'

/**
 * AnimatedCounter — spring-animated count-up that triggers when in viewport.
 * Uses motion springs for a natural, physical feel.
 */
export default function AnimatedCounter({ value, duration = 1.5, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    duration: duration * 1000,
  })

  useEffect(() => {
    if (isInView) {
      motionValue.set(value)
    }
  }, [isInView, value, motionValue])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.round(latest).toLocaleString()
      }
    })
    return unsubscribe
  }, [springValue])

  return <span ref={ref} className={className}>0</span>
}
