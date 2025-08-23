import Link from 'next/link'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Portfolio AI'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            ← Back to Chat
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          About {APP_NAME}
        </h1>
        
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">What is this?</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Educational Tutor is an AI-powered learning assistant designed to help students learn through 
              guided discovery rather than providing direct answers. The app promotes deeper understanding 
              by offering hints first, encouraging critical thinking, and providing step-by-step explanations.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">How it works</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="text-lg font-medium mb-2">Hints Mode (Default)</h3>
                <p>
                  When hints mode is enabled, the tutor provides 1-2 helpful hints to guide your thinking 
                  without revealing the complete solution. This encourages you to work through problems 
                  and develop problem-solving skills.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Solution Mode</h3>
                <p>
                  Toggle off hints mode or click &quot;Show Solution&quot; to receive complete explanations 
                  with step-by-step reasoning and final answers. This is helpful when you need to 
                  understand the full solution process.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Content Safety</h3>
                <p>
                  All messages are automatically moderated to ensure appropriate educational content. 
                  The system will politely redirect inappropriate requests toward educational topics.
                </p>
              </div>
            </div>
          </section>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Privacy & Data</h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Important Privacy Notice
              </h3>
              <ul className="text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                <li>This is an MVP (Minimum Viable Product) with no user accounts or data storage</li>
                <li>Your messages are sent to OpenAI&apos;s API to generate responses</li>
                <li>Conversations are not saved or stored on our servers</li>
                <li>Do not enter personal, sensitive, or confidential information</li>
                <li>Use the export/copy features to save important conversations locally</li>
              </ul>
            </div>
          </section>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Usage Limits</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To ensure fair usage for all users, there&apos;s a rate limit of 60 requests per minute per IP address. 
              If you exceed this limit, please wait a moment before sending another message.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Messages are limited to 1,500 characters to keep responses focused and cost-effective.
            </p>
          </section>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Best Practices</h2>
            <ul className="text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
              <li>Start with hints mode to develop your problem-solving skills</li>
              <li>Be specific in your questions for better guidance</li>
              <li>Try working through hints before requesting the full solution</li>
              <li>Use the export feature to save helpful explanations for later review</li>
              <li>Focus on educational topics like math, science, history, literature, and more</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-4">Technical Details</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              This application is built with Next.js 14, uses OpenAI&apos;s GPT models for responses, 
              and implements real-time streaming for a smooth user experience. It&apos;s designed to be 
              fast, accessible, and mobile-friendly.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {APP_NAME} MVP - Focused on learning through guided discovery
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}