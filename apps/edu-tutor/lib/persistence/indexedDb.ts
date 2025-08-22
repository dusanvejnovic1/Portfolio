/**
 * IndexedDB helpers for local persistence
 */

import { 
  CurriculumPlan, 
  AssignmentSet, 
  AssessmentResult, 
  ResourceCard,
  ResourcesSearchResponse 
} from '../../types/modes'

const DB_NAME = 'EduTutorDB'
const DB_VERSION = 1

const STORES = {
  PLANS: 'curriculum_plans',
  ASSIGNMENTS: 'assignments',
  ASSESSMENTS: 'assessments',
  RESOURCES: 'resources_queries',
  SAVED_RESOURCES: 'saved_resources'
}

/**
 * Initialize IndexedDB database
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      // Curriculum plans store
      if (!db.objectStoreNames.contains(STORES.PLANS)) {
        const plansStore = db.createObjectStore(STORES.PLANS, { 
          keyPath: 'id',
          autoIncrement: true 
        })
        plansStore.createIndex('topic', 'topic', { unique: false })
        plansStore.createIndex('level', 'level', { unique: false })
        plansStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      // Assignments store
      if (!db.objectStoreNames.contains(STORES.ASSIGNMENTS)) {
        const assignmentsStore = db.createObjectStore(STORES.ASSIGNMENTS, {
          keyPath: 'id',
          autoIncrement: true
        })
        assignmentsStore.createIndex('topic', 'topic', { unique: false })
        assignmentsStore.createIndex('difficulty', 'difficulty', { unique: false })
        assignmentsStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      // Assessments store
      if (!db.objectStoreNames.contains(STORES.ASSESSMENTS)) {
        const assessmentsStore = db.createObjectStore(STORES.ASSESSMENTS, {
          keyPath: 'id',
          autoIncrement: true
        })
        assessmentsStore.createIndex('createdAt', 'createdAt', { unique: false })
        assessmentsStore.createIndex('overallScore', 'result.overallScore', { unique: false })
      }
      
      // Resources queries store
      if (!db.objectStoreNames.contains(STORES.RESOURCES)) {
        const resourcesStore = db.createObjectStore(STORES.RESOURCES, {
          keyPath: 'id',
          autoIncrement: true
        })
        resourcesStore.createIndex('topic', 'topic', { unique: false })
        resourcesStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      // Saved resources store
      if (!db.objectStoreNames.contains(STORES.SAVED_RESOURCES)) {
        const savedResourcesStore = db.createObjectStore(STORES.SAVED_RESOURCES, {
          keyPath: 'id',
          autoIncrement: true
        })
        savedResourcesStore.createIndex('url', 'url', { unique: false })
        savedResourcesStore.createIndex('source', 'source', { unique: false })
        savedResourcesStore.createIndex('savedAt', 'savedAt', { unique: false })
      }
    }
  })
}

/**
 * Generic database operation helper
 */
function performDBOperation<T>(
  storeName: string,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  mode: IDBTransactionMode = 'readonly'
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB()
      const transaction = db.transaction([storeName], mode)
      const store = transaction.objectStore(storeName)
      
      const request = operation(store)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    } catch (error) {
      reject(error)
    }
  })
}

// Curriculum Plans Persistence
export interface StoredCurriculumPlan extends CurriculumPlan {
  id?: number
  createdAt: Date
  updatedAt: Date
}

export async function saveCurriculumPlan(plan: CurriculumPlan): Promise<number> {
  const storedPlan: StoredCurriculumPlan = {
    ...plan,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const result = await performDBOperation(
    STORES.PLANS,
    (store) => store.add(storedPlan),
    'readwrite'
  )
  
  return Number(result)
}

export async function updateCurriculumPlan(id: number, plan: Partial<CurriculumPlan>): Promise<void> {
  const existingPlan = await getCurriculumPlan(id)
  if (!existingPlan) {
    throw new Error('Plan not found')
  }
  
  const updatedPlan: StoredCurriculumPlan = {
    ...existingPlan,
    ...plan,
    updatedAt: new Date()
  }
  
  await performDBOperation(
    STORES.PLANS,
    (store) => store.put(updatedPlan),
    'readwrite'
  )
}

export async function getCurriculumPlan(id: number): Promise<StoredCurriculumPlan | null> {
  try {
    const result = await performDBOperation(
      STORES.PLANS,
      (store) => store.get(id)
    )
    return result || null
  } catch {
    return null
  }
}

export async function getAllCurriculumPlans(): Promise<StoredCurriculumPlan[]> {
  return performDBOperation(
    STORES.PLANS,
    (store) => store.getAll()
  )
}

export async function deleteCurriculumPlan(id: number): Promise<void> {
  await performDBOperation(
    STORES.PLANS,
    (store) => store.delete(id),
    'readwrite'
  )
}

// Assignments Persistence
export interface StoredAssignmentSet extends AssignmentSet {
  id?: number
  createdAt: Date
  updatedAt: Date
}

export async function saveAssignmentSet(assignmentSet: AssignmentSet): Promise<number> {
  const storedSet: StoredAssignmentSet = {
    ...assignmentSet,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const result = await performDBOperation(
    STORES.ASSIGNMENTS,
    (store) => store.add(storedSet),
    'readwrite'
  )
  
  return Number(result)
}

export async function getAssignmentSet(id: number): Promise<StoredAssignmentSet | null> {
  try {
    const result = await performDBOperation(
      STORES.ASSIGNMENTS,
      (store) => store.get(id)
    )
    return result || null
  } catch {
    return null
  }
}

export async function getAllAssignmentSets(): Promise<StoredAssignmentSet[]> {
  return performDBOperation(
    STORES.ASSIGNMENTS,
    (store) => store.getAll()
  )
}

// Assessments Persistence
export interface StoredAssessment {
  id?: number
  assignmentText: string
  submissionText: string
  result: AssessmentResult
  createdAt: Date
}

export async function saveAssessment(
  assignmentText: string,
  submissionText: string,
  result: AssessmentResult
): Promise<number> {
  const storedAssessment: StoredAssessment = {
    assignmentText,
    submissionText,
    result,
    createdAt: new Date()
  }
  
  const dbResult = await performDBOperation(
    STORES.ASSESSMENTS,
    (store) => store.add(storedAssessment),
    'readwrite'
  )
  
  return Number(dbResult)
}

export async function getAssessment(id: number): Promise<StoredAssessment | null> {
  try {
    const result = await performDBOperation(
      STORES.ASSESSMENTS,
      (store) => store.get(id)
    )
    return result || null
  } catch {
    return null
  }
}

export async function getAllAssessments(): Promise<StoredAssessment[]> {
  return performDBOperation(
    STORES.ASSESSMENTS,
    (store) => store.getAll()
  )
}

// Resources Queries Persistence
export interface StoredResourceQuery {
  id?: number
  topic: string
  level?: string
  response: ResourcesSearchResponse
  createdAt: Date
}

export async function saveResourceQuery(
  topic: string,
  level: string | undefined,
  response: ResourcesSearchResponse
): Promise<number> {
  const storedQuery: StoredResourceQuery = {
    topic,
    level,
    response,
    createdAt: new Date()
  }
  
  const result = await performDBOperation(
    STORES.RESOURCES,
    (store) => store.add(storedQuery),
    'readwrite'
  )
  
  return Number(result)
}

export async function getResourceQueries(topic?: string): Promise<StoredResourceQuery[]> {
  if (topic) {
    return performDBOperation(
      STORES.RESOURCES,
      (store) => {
        const index = store.index('topic')
        return index.getAll(topic)
      }
    )
  }
  
  return performDBOperation(
    STORES.RESOURCES,
    (store) => store.getAll()
  )
}

// Saved Resources Persistence
export interface SavedResource extends ResourceCard {
  id?: number
  savedAt: Date
  notes?: string
  tags?: string[]
}

export async function saveResource(
  resource: ResourceCard,
  notes?: string,
  tags?: string[]
): Promise<number> {
  const savedResource: SavedResource = {
    ...resource,
    savedAt: new Date(),
    notes,
    tags
  }
  
  const result = await performDBOperation(
    STORES.SAVED_RESOURCES,
    (store) => store.add(savedResource),
    'readwrite'
  )
  
  return Number(result)
}

export async function getSavedResources(): Promise<SavedResource[]> {
  return performDBOperation(
    STORES.SAVED_RESOURCES,
    (store) => store.getAll()
  )
}

export async function removeSavedResource(id: number): Promise<void> {
  await performDBOperation(
    STORES.SAVED_RESOURCES,
    (store) => store.delete(id),
    'readwrite'
  )
}

export async function updateSavedResource(
  id: number,
  updates: Partial<SavedResource>
): Promise<void> {
  const existing = await performDBOperation(
    STORES.SAVED_RESOURCES,
    (store) => store.get(id)
  )
  
  if (!existing) {
    throw new Error('Saved resource not found')
  }
  
  const updated = { ...existing, ...updates }
  
  await performDBOperation(
    STORES.SAVED_RESOURCES,
    (store) => store.put(updated),
    'readwrite'
  )
}

/**
 * Clear all data (for debugging/testing)
 */
export async function clearAllData(): Promise<void> {
  const storeNames = [STORES.PLANS, STORES.ASSIGNMENTS, STORES.ASSESSMENTS, STORES.RESOURCES, STORES.SAVED_RESOURCES]
  
  const promises = storeNames.map(storeName => 
    performDBOperation(storeName, (store) => store.clear(), 'readwrite')
  )
  
  await Promise.all(promises)
}

/**
 * Export all data for backup
 */
export async function exportAllData(): Promise<{
  plans: StoredCurriculumPlan[]
  assignments: StoredAssignmentSet[]
  assessments: StoredAssessment[]
  resourceQueries: StoredResourceQuery[]
  savedResources: SavedResource[]
}> {
  const [plans, assignments, assessments, resourceQueries, savedResources] = await Promise.all([
    getAllCurriculumPlans(),
    getAllAssignmentSets(),
    getAllAssessments(),
    getResourceQueries(),
    getSavedResources()
  ])
  
  return {
    plans,
    assignments,
    assessments,
    resourceQueries,
    savedResources
  }
}