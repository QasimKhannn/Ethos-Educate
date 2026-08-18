export type GradingMode = 'SCORE' | 'FEEDBACK' | 'IMPROVE';

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
  total: { points: number; maxPoints: number; percentage: number } | null;
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

export interface GradingRequestBody {
  text: string;
  mode: GradingMode;
  rubricId?: string;
  customRubric?: CustomRubric;
  title?: string;
  instructions?: string;
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
