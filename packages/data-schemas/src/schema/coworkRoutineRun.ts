// cowork — Phase 4: per-run history for Cowork routines. One document per execution (manual or
// scheduled), separate from the CoworkRoutine summary fields (which only hold the LAST run). Lives
// in its own collection; ownership is carried via `user` for owner-scoped reads.
import { Schema, Document } from 'mongoose';

export interface IMongoCoworkRoutineRun extends Document {
  /** The routine this run belongs to. */
  routineId: string;
  /** Owner user id (mirrors the routine's user, for owner-scoped queries). */
  user: string;
  /** The CoworkProject the run executed in. */
  projectId: string;
  /** What triggered the run: 'manual' (Run now) or 'scheduled' (the cron poller). */
  trigger: string;
  /** Outcome: 'running' while in flight, then 'success' | 'error'. */
  status: string;
  /** Error message when status is 'error'. */
  error?: string;
  /** Conversation the run's output was written to. */
  conversationId?: string;
  /** Workspace-relative path the result was delivered to (when deliveryTarget = 'file'). */
  deliveredPath?: string;
  /** When the run started. */
  startedAt: Date;
  /** When the run finished (unset while running). */
  finishedAt?: Date;
  /** Wall-clock duration in milliseconds (set on finish). */
  durationMs?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const coworkRoutineRunSchema = new Schema<IMongoCoworkRoutineRun>(
  {
    routineId: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
    },
    trigger: {
      type: String,
      default: 'manual',
    },
    status: {
      type: String,
      default: 'running',
    },
    error: {
      type: String,
    },
    conversationId: {
      type: String,
    },
    deliveredPath: {
      type: String,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    finishedAt: {
      type: Date,
    },
    durationMs: {
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);

// For the history UI: list a routine's runs, newest first.
coworkRoutineRunSchema.index({ routineId: 1, startedAt: -1 });

export default coworkRoutineRunSchema;
