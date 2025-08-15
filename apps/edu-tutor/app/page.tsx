import Chat from '@/components/Chat'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <div className="absolute top-4 right-4">
        <Link 
          href="/about"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          About
        </Link>
      </div>
      <Chat />
    </div>
  )
}