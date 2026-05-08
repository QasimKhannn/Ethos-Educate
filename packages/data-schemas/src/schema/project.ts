import { Schema, Document, Types } from 'mongoose';

export interface IMongoProject extends Document {
  name: string;
  user?: string;
  description?: string;
  instructions?: string;
  promptGroupIds: Types.ObjectId[];
  agentIds: string[];
  conversationIds: string[];
  fileIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const projectSchema = new Schema<IMongoProject>(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
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
    promptGroupIds: {
      type: [Schema.Types.ObjectId],
      ref: 'PromptGroup',
      default: [],
    },
    agentIds: {
      type: [String],
      ref: 'Agent',
      default: [],
    },
    conversationIds: {
      type: [String],
      default: [],
    },
    fileIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ user: 1, updatedAt: -1 });

export default projectSchema;
