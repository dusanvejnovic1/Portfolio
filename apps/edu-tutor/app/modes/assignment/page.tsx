import Link from 'next/link'
import AssignmentMode from '@/components/modes/AssignmentMode'

export default function AssignmentPage() {
  return (
    <div>
      <div className="max-w-3xl mx-auto p-6 pb-2">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            ← Back to Main
          </Link>
        </div>
      </div>
      <AssignmentMode />
    </div>
  )
}