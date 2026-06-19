// cowork — Routines (scheduled automations) live in their OWN collection, fully separate from
// everything else. A routine = a saved prompt + schedule that runs against a CoworkProject.
// Phase 1 only uses: name, user, projectId, prompt, mode, enabled, lastRun/lastStatus.
// cronExpression / nextRun (Phase 2 scheduler) and autoApprove / deliveryTarget (Phase 4/5) are
// stored now but unused until those phases.
import { Schema, Document } from 'mongoose';

export interface IMongoCoworkRoutine extends Document {
  /** Human label shown in the Routines UI. */
  name: string;
  /** Owner user id (string, matches CoworkProject.user). */
  user: string;
  /** The CoworkProject this routine runs inside. */
  projectId: string;
  /** The instruction the coworker runs each time. */
  prompt: string;
  /** Cron expression for the schedule (Phase 2). Empty until scheduled. */
  cronExpression?: string;
  /** Run mode — routines run in 'agent' mode by default. */
  mode: string;
  /** Whether the schedule is active (Phase 2). Manual run-now ignores this. */
  enabled: boolean;
  /** Auto-approve write actions on scheduled runs (Phase 5). Off by default = queue for approval. */
  autoApprove: boolean;
  /** Where results are delivered (Phase 4), e.g. 'message'. */
  deliveryTarget?: string;
  /** Next scheduled fire time (Phase 2). */
  nextRun?: Date;
  /** Last time this routine ran (manual or scheduled). */
  lastRun?: Date;
  /** Outcome of the last run: 'success' | 'error' | 'running'. */
  lastStatus?: string;
  /** Error message from the last failed run, if any. */
  lastError?: string;
  /** Conversation the last run's output was written to. */
  lastConversationId?: string;
  /** Phase 6: consecutive failed runs; reset to 0 on success. Drives the auto-disable breaker. */
  consecutiveFailures?: number;
  /** Phase 6: why the routine was auto-disabled (e.g. repeated failures). Empty when healthy. */
  disabledReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const coworkRoutineSchema = new Schema<IMongoCoworkRoutine>(
  {
    name: {
      type: String,
      required: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    cronExpression: {
      type: String,
      default: '',
    },
    mode: {
      type: String,
      default: 'agent',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    autoApprove: {
      type: Boolean,
      default: false,
    },
    deliveryTarget: {
      type: String,
      default: 'message',
    },
    nextRun: {
      type: Date,
    },
    lastRun: {
      type: Date,
    },
    lastStatus: {
      type: String,
    },
    lastError: {
      type: String,
    },
    lastConversationId: {
      type: String,
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    disabledReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// For the scheduler (Phase 2): quickly find enabled routines whose nextRun is due.
coworkRoutineSchema.index({ enabled: 1, nextRun: 1 });
// For the UI: list a user's routines, newest first.
coworkRoutineSchema.index({ user: 1, updatedAt: -1 });

export default coworkRoutineSchema;
