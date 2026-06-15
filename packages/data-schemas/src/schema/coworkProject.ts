// cowork — Cowork projects live in their OWN collection, fully separate from the
// existing `Project` model, so nothing about the current projects feature is touched.
import { Schema, Document } from 'mongoose';

export interface IMongoCoworkProject extends Document {
  name: string;
  /** Owner user id (string, matches how Project stores `user`). */
  user: string;
  description?: string;
  /** Optional per-project guidance appended to the Cowork agent prompt. */
  instructions?: string;
  /** Skill ids enabled for this project (builtin ids like "pptx", or custom ids). */
  enabledSkills: string[];
  /** Conversations that belong to this project. */
  conversationIds: string[];
  archived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const coworkProjectSchema = new Schema<IMongoCoworkProject>(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    instructions: {
      type: String,
      default: '',
    },
    enabledSkills: {
      type: [String],
      default: [],
    },
    conversationIds: {
      type: [String],
      default: [],
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

coworkProjectSchema.index({ user: 1, updatedAt: -1 });

export default coworkProjectSchema;
