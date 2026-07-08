// cowork — Phase A / A2. Per-user CUSTOM skills live in their own collection, fully
// separate from everything else. A custom skill = a name + description + markdown body
// (instructions the coworker follows). Owned by a user; enabled per-project via the
// project's `enabledSkills` array using the id form `custom:<_id>`. Built-in skills are
// unchanged (they live on disk, not here). No executable scripts in v1 — markdown only.
import { Schema, Document } from 'mongoose';

export interface IMongoCoworkSkill extends Document {
  /** Owner user id (string, matches CoworkProject.user). */
  user: string;
  /** Human label shown in the Skills panel. */
  name: string;
  /** Short description shown under the name. */
  description: string;
  /** The full markdown instructions injected into the agent prompt when enabled. */
  content: string;
  /** Provenance marker — always 'custom' for this collection. */
  source: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const coworkSkillSchema = new Schema<IMongoCoworkSkill>(
  {
    user: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      default: 'custom',
    },
  },
  {
    timestamps: true,
  },
);

// For the UI: list a user's custom skills, newest first.
coworkSkillSchema.index({ user: 1, updatedAt: -1 });

export default coworkSkillSchema;
