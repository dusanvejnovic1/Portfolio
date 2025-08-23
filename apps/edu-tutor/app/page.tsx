import AppLayout from '@/components/AppLayout'
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      {/* About link - positioned absolutely to stay visible */}
      <div className="fixed top-4 right-4 z-40">
        <Link 
          href="/about"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded bg-white dark:bg-gray-800 px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          About
        </Link>
      </div>
      <AppLayout />
    </>
  )
}