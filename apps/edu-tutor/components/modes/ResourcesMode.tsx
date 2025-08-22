'use client'

import { useState } from 'react'
import { 
  ResourceCard,
  ResourcesSearchRequest, 
  ResourcesSearchResponse,
  LearningLevel 
} from '@/types/modes'

export default function ResourcesMode() {
  const [formData, setFormData] = useState<ResourcesSearchRequest>({
    topic: '',
    level: 'Beginner',
    preferences: {
      video: true,
      docs: true,
      course: true
    },
    preferOfficial: true
  })
  const [results, setResults] = useState<ResourcesSearchResponse | null>(null)
  const [savedResources, setSavedResources] = useState<ResourceCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.topic) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/modes/resources/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Failed to search resources:', error)
    }
    setIsLoading(false)
  }

  const saveResource = (resource: ResourceCard) => {
    if (!savedResources.find(r => r.url === resource.url)) {
      setSavedResources(prev => [...prev, resource])
    }
  }

  const removeResource = (url: string) => {
    setSavedResources(prev => prev.filter(r => r.url !== url))
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return ''
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours}h ${remainingMinutes}m`
    }
    return `${minutes}m ${seconds}s`
  }

  const getRelevanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    if (score >= 75) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400'
  }

  const ResourceCardComponent = ({ resource, isSaved = false, onSave, onRemove }: {
    resource: ResourceCard
    isSaved?: boolean
    onSave?: () => void
    onRemove?: () => void
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            <a 
              href={resource.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {resource.title}
            </a>
          </h3>
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <span className="capitalize">{resource.source}</span>
            {resource.publisher && (
              <>
                <span>•</span>
                <span>{resource.publisher}</span>
              </>
            )}
            {resource.duration && (
              <>
                <span>•</span>
                <span>{formatDuration(resource.duration)}</span>
              </>
            )}
            {resource.lastUpdated && (
              <>
                <span>•</span>
                <span>Updated {new Date(resource.lastUpdated).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className={`text-xs font-medium px-2 py-1 rounded ${getRelevanceColor(resource.relevanceScore)}`}>
            {resource.relevanceScore}% match
          </span>
          {isSaved ? (
            <button
              onClick={onRemove}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
              title="Remove from saved"
            >
              ❌
            </button>
          ) : (
            <button
              onClick={onSave}
              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
              title="Save resource"
            >
              💾
            </button>
          )}
        </div>
      </div>

      {resource.badges && resource.badges.length > 0 && (
        <div className="flex gap-2 mb-3">
          {resource.badges.map((badge, index) => (
            <span 
              key={index}
              className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded"
            >
              {badge.replace('-', ' ')}
            </span>
          ))}
        </div>
      )}

      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
        {resource.relevanceRationale}
      </p>

      {resource.keyTakeaways && resource.keyTakeaways.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">Key Takeaways:</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {resource.keyTakeaways.map((takeaway, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Learning Resources
        </h2>
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Search Resources
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'saved'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Saved ({savedResources.length})
          </button>
        </div>
      </div>

      {activeTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Search Form */}
          <div className="lg:col-span-1">
            <form onSubmit={handleSearch} className="space-y-6 sticky top-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Topic
                </label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({...formData, topic: e.target.value})}
                  placeholder="e.g., React hooks, Docker deployment"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Level
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({...formData, level: e.target.value as LearningLevel})}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Resource Types
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.preferences?.video}
                      onChange={(e) => setFormData({
                        ...formData, 
                        preferences: {...formData.preferences, video: e.target.checked}
                      })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Videos</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.preferences?.docs}
                      onChange={(e) => setFormData({
                        ...formData, 
                        preferences: {...formData.preferences, docs: e.target.checked}
                      })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Documentation</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.preferences?.course}
                      onChange={(e) => setFormData({
                        ...formData, 
                        preferences: {...formData.preferences, course: e.target.checked}
                      })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Courses</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.preferOfficial}
                    onChange={(e) => setFormData({...formData, preferOfficial: e.target.checked})}
                    className="mr-2 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300 text-sm">Prefer official sources</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Searching...' : 'Search Resources'}
              </button>
            </form>
          </div>

          {/* Search Results */}
          <div className="lg:col-span-3">
            {isLoading && (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {results && (
              <div className="space-y-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Found {results.items.length} resources for &ldquo;{results.meta.query}&rdquo; • 
                  Generated {new Date(results.meta.generatedAt).toLocaleDateString()}
                </div>
                
                <div className="space-y-4">
                  {results.items.map((resource, index) => (
                    <ResourceCardComponent
                      key={index}
                      resource={resource}
                      onSave={() => saveResource(resource)}
                    />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && !results && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                Search for learning resources to get started
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedResources.length > 0 ? (
            savedResources.map((resource, index) => (
              <ResourceCardComponent
                key={index}
                resource={resource}
                isSaved={true}
                onRemove={() => removeResource(resource.url)}
              />
            ))
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              No saved resources yet. Search and save resources to access them later.
            </div>
          )}
        </div>
      )}
    </div>
  )
}