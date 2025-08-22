/**
 * Core types for IT-focused educational modes
 */

export type GuidanceStyle = 'hints' | 'solutions'

export type LearningLevel = 'Beginner' | 'Intermediate' | 'Advanced'

export type Mode = 'Chat' | 'Curriculum' | 'Assignment' | 'Assessment' | 'Resources'

// Curriculum Types
export interface CurriculumConstraints {
  timePerDayMins?: number
  os?: string
  cloud?: string
  tools?: string[]
  prerequisitesOk?: boolean
}

export interface CurriculumWeek {
  week: number
  focus: string
  notes?: string
}

export interface CurriculumDay {
  day: number
  title: string
  summary: string
  goals: string[]
  theorySteps: string[]
  handsOnSteps: string[]
  resources: Array<{
    title: string
    url: string
    type: 'documentation' | 'video' | 'tutorial' | 'tool'
  }>
  assignment: string
  checkForUnderstanding: string[]
}

export interface CurriculumPlan {
  topic: string
  level: LearningLevel
  durationDays: number
  outline: CurriculumWeek[]
  days: CurriculumDay[]
  cursor?: {
    nextDay: number
    batchSize: number
  }
}

// Assignment Types
export interface RubricCriterion {
  name: string
  description: string
  weight: number // 0-1, should sum to 1.0
  levels: Array<{
    score: number // 0-5
    description: string
  }>
}

export interface AssignmentVariant {
  id: string
  title: string
  scenario: string
  objectives: string[]
  steps: string[]
  deliverables: string[]
  rubric: RubricCriterion[]
  hints?: string[]
  solutionOutline?: string
  stretchGoals?: string[]
}

export interface AssignmentSet {
  topic: string
  difficulty: LearningLevel
  variants: AssignmentVariant[]
  timeBudgetHrs?: number
}

// Assessment Types
export interface AssessmentResult {
  overallScore: number // 0-5 in 0.5 increments
  summary: string
  whatWasGood: string[]
  needsImprovement: string[]
  mustFix: string[]
  nextSteps: string[]
  rubricBreakdown: Array<{
    criterion: string
    score: number
    evidence: string
    feedback: string
  }>
}

// Resources Types
export interface ResourceCard {
  title: string
  url: string
  source: 'web' | 'youtube' | 'documentation'
  publisher?: string
  length?: string
  duration?: number // in seconds for videos
  publishedAt?: string
  lastUpdated?: string
  relevanceScore: number // 0-100
  relevanceRationale: string
  keyTakeaways: string[]
  isOfficial?: boolean
  badges?: Array<'official' | 'recent' | 'comprehensive' | 'beginner-friendly' | 'advanced'>
}

export interface ResourceSearchMeta {
  query: string
  generatedAt: string
  preferences?: {
    video?: boolean
    docs?: boolean
    course?: boolean
  }
  preferOfficial?: boolean
  verified?: boolean // Whether results came from verified search provider
}

// API Request/Response Types
export interface CurriculumOutlineRequest {
  topic: string
  level: LearningLevel
  durationDays: number
  constraints?: CurriculumConstraints
}

export interface CurriculumOutlineResponse {
  outline: CurriculumWeek[]
  suggestedAdjustments?: string[]
}

export interface CurriculumGenerateRequest {
  topic: string
  level: LearningLevel
  durationDays: number
  batch: {
    startDay: number
    endDay: number
  }
  outline?: CurriculumWeek[]
  useWeb?: boolean
  retrievalContext?: any
}

export interface CurriculumGenerateResponse {
  type: 'progress' | 'day' | 'error'
  value?: string
  day?: CurriculumDay
  message?: string
}

export interface AssignmentGenerateRequest {
  topic: string
  difficulty: LearningLevel
  skills?: string[]
  constraints?: any
  timeBudgetHrs?: number
  guidanceStyle?: GuidanceStyle
}

export interface AssignmentGenerateResponse {
  set: AssignmentVariant[]
}

export interface AssessmentScoreRequest {
  assignmentText: string
  submissionTextOrLink: string
  rubric?: RubricCriterion[]
}

export interface ResourcesSearchRequest {
  topic: string
  level?: LearningLevel
  preferences?: {
    video?: boolean
    docs?: boolean
    course?: boolean
  }
  preferOfficial?: boolean
}

export interface ResourcesSearchResponse {
  items: ResourceCard[]
  meta: ResourceSearchMeta
}

// Batch Generation Types
export interface BatchProgress {
  currentDay: number
  totalDays: number
  batchSize: number
  isComplete: boolean
  error?: string
}

// State Management Types
export interface ModeState {
  currentMode: Mode
  guidanceStyle: GuidanceStyle
  useWeb: boolean
}

export interface CurriculumState {
  currentPlan?: CurriculumPlan
  isGenerating: boolean
  batchProgress?: BatchProgress
  selectedDay?: number
}

export interface AssignmentState {
  currentSet?: AssignmentSet
  selectedVariant?: string
  isGenerating: boolean
}

export interface AssessmentState {
  lastResult?: AssessmentResult
  isScoring: boolean
}

export interface ResourcesState {
  lastSearch?: ResourcesSearchResponse
  isSearching: boolean
  savedResources: ResourceCard[]
}