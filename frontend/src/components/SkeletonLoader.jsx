import { motion } from 'motion/react'

export function SkeletonCard() {
  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded skeleton" />
          <div className="h-3 w-1/2 rounded skeleton" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-5 w-16 rounded skeleton" />
        <div className="h-5 w-20 rounded skeleton" />
      </div>
      <div className="flex justify-between mt-4">
        <div className="h-3 w-16 rounded skeleton" />
        <div className="h-3 w-14 rounded skeleton" />
      </div>
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 text-center">
      <div className="h-8 w-16 mx-auto rounded skeleton" />
      <div className="h-3 w-20 mx-auto mt-2 rounded skeleton" />
    </div>
  )
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <SkeletonCard />
        </motion.div>
      ))}
    </div>
  )
}
