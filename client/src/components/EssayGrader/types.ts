export type GradingMode = 'SCORE' | 'FEEDBACK' | 'IMPROVE' | 'PROOFREAD';

export interface RubricSummary {
  id: string;
  slug: string;
  name: string;
  summary: string;
  gradeBand: string;
  subject: string;
  jurisdiction: string | null;
  version: number;
  authoredBy: string;
  totalPoints: number;
  criteria: Array<{
    id: string;
    name: string;
    description: string;
    maxPoints: number;
  }>;
}

export type EvidencePolarity = 'STRENGTH' | 'GROWTH';

export interface EvidenceSpan {
  quote: string;
  note: string;
  polarity: EvidencePolarity;
  criterionId: string | null;
  start: number;
  end: number;
  matchKind: 'EXACT' | 'NORMALISED';
}

export interface CriterionResult {
  criterionId: string;
  name: string;
  description: string;
  maxPoints: number;
  points: number | null;
  /** False when the grader skipped this criterion; it is then left out of the total. */
  judged: boolean;
  levelLabel: string | null;
  rationale: string;
  evidence: EvidenceSpan[];
}

export interface TextMetrics {
  characters: number;
  words: number;
  sentences: number;
  paragraphs: number;
  averageSentenceWords: number;
  sentenceLengthVariation: number;
  longestParagraphWords: number;
}

export interface EngineStamp {
  name: string;
  label: string;
  isDemo: boolean;
  disclaimer: string | null;
  modelVersion: string;
  promptVersion: string;
}

export interface GradingResultDocument {
  mode: GradingMode;
  rubric: Omit<RubricSummary, 'criteria' | 'totalPoints' | 'jurisdiction' | 'authoredBy'> | null;
  criteria: CriterionResult[];
  total: {
    points: number;
    maxPoints: number;
    percentage: number;
    /** Criteria the grader skipped, excluded from the total above. */
    unjudged: number;
  } | null;
  overallComment: string;
  strengths: string[];
  nextSteps: string[];
  generalEvidence: EvidenceSpan[];
  confidence: number;
  metrics: TextMetrics;
  engine: EngineStamp;
}

export interface QuotaState {
  used: number;
  limit: number | null;
  remaining: number | null;
  resetsAt: string | null;
}

export interface GradingResponse {
  id: string;
  createdAt: string;
  mode: GradingMode;
  title: string | null;
  text: string;
  wordCount: number;
  result: GradingResultDocument;
  quota: QuotaState;
  /**
   * Modes with a stored result for this submission. A tab in this list opens
   * instantly and costs nothing; one that is not will run the engine and use
   * an allowance, so the UI says so before the click rather than after.
   */
  availableModes: GradingMode[];
}

export interface ToolStatus {
  engine: Pick<EngineStamp, 'name' | 'label' | 'isDemo' | 'disclaimer'>;
  quota: QuotaState;
  limits: { minWords: number; maxWords: number };
}

export interface CustomRubric {
  name?: string;
  criteria: Array<{ name: string; description?: string; maxPoints: number }>;
}

/** The id a custom rubric carries in the browser. Never a database id. */
export const CUSTOM_RUBRIC_ID = 'custom';

export interface GradingRequestBody {
  text: string;
  mode: GradingMode;
  rubricId?: string;
  customRubric?: CustomRubric;
  title?: string;
  instructions?: string;
  /**
   * SCORE only: run the grammar/spelling check in the same model call as the
   * rubric scoring instead of as a separate pass. See the backend's
   * `CreateGradingDto`.
   */
  includeGrammar?: boolean;
}

/**
 * Batch grading — several essays graded against one shared rubric/mode in
 * one submission. Mirrors the standalone Co-grader app's batch types; the
 * backend endpoints (`/public/gradings/batches`) already serve both apps.
 */
export type BatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

export interface BatchItemSummary {
  id: string;
  batchIndex: number;
  title: string | null;
  wordCount: number;
  status: BatchStatus;
  score: { points: number; maxPoints: number; percentage: number } | null;
  error: string | null;
}

export interface BatchSummary {
  batchId: string;
  quota: QuotaState;
  items: BatchItemSummary[];
}

export interface BatchGradingItem {
  text: string;
  title?: string;
}

export interface CreateBatchRequestBody {
  items: BatchGradingItem[];
  mode: GradingMode;
  rubricId?: string;
  customRubric?: CustomRubric;
  instructions?: string;
  /** SCORE only: bundle the grammar check into the same pass for every essay. */
  includeGrammar?: boolean;
}

export interface ExtractedDocument {
  text: string;
  format: 'docx' | 'pdf' | 'txt' | 'rtf';
  filename: string;
  pages: number | null;
  warnings: string[];
}

export interface EssayGraderApiErrorBody {
  message?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * AI writing-pattern detection — a separate top-level tool from grading
 * (`toolKind: 'detect'` in the wizard), not another grading mode. See the
 * backend's `modules/detection/` and `claude/ai-detection-tool-research.md`
 * in the project for why this is deliberately not a verdict tool: every
 * score below is always paired with the evidence behind it.
 */
export interface DetectionEvidenceSpan {
  start: number;
  end: number;
  quote: string;
}

export type DetectionSignalKey =
  | 'burstiness'
  | 'vocabulary'
  | 'buzzwords'
  | 'transitions'
  | 'formatting'
  | 'paragraphUniformity'
  | 'informality';

export interface DetectionSignal {
  key: DetectionSignalKey;
  label: string;
  /** 0-100. Higher means more consistent with the pattern this signal looks for — never rendered alone. */
  score: number;
  description: string;
  evidence: DetectionEvidenceSpan[];
  matchCount?: number;
}

export type DetectionBand = 'INCONCLUSIVE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface DetectionResultDocument {
  /** Null only when the submission is too short to say anything meaningful. */
  overallSignalScore: number | null;
  band: DetectionBand;
  bandLabel: string;
  signals: DetectionSignal[];
  wordCount: number;
  disclaimer: string;
}

export interface DetectionResponse {
  id: string;
  createdAt: string;
  title: string | null;
  text: string;
  wordCount: number;
  result: DetectionResultDocument;
  quota: QuotaState;
}

export interface DetectionRequestBody {
  text: string;
  title?: string;
}

export interface DetectionToolStatus {
  quota: QuotaState;
  limits: { minWords: number };
}

/**
 * Batch AI detection -- several essays analyzed at once, each independently
 * (there is no shared rubric or mode the way batch grading has one). Mirrors
 * the standalone Co-grader app's batch-detection types; the backend endpoints
 * (`/public/detection/batches`) already serve both apps.
 *
 * Simpler than `BatchItemSummary`/`BatchSummary` above: no PENDING/PROCESSING
 * status, because every row a batch-detection call returns is already
 * COMPLETE (see the backend's `DetectionService.createBatch` -- analysis is
 * synchronous, so a whole batch finishes inside the request that started it).
 */
export interface BatchDetectionItemSummary {
  id: string;
  batchIndex: number;
  title: string | null;
  wordCount: number;
  status: 'COMPLETE' | 'FAILED';
  overallSignalScore: number | null;
  band: DetectionBand;
  bandLabel: string;
  error?: string | null;
}

export interface BatchDetectionSummary {
  batchId: string;
  quota: QuotaState;
  items: BatchDetectionItemSummary[];
}

export interface BatchDetectionItemRequestBody {
  text: string;
  title?: string;
}

export interface CreateBatchDetectionRequestBody {
  items: BatchDetectionItemRequestBody[];
}
