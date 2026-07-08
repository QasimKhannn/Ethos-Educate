// cowork
import coworkSkillSchema, { IMongoCoworkSkill } from '~/schema/coworkSkill';

/**
 * Creates or returns the CoworkSkill model. Separate collection — per-user custom skills.
 */
export function createCoworkSkillModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.CoworkSkill ||
    mongoose.model<IMongoCoworkSkill>('CoworkSkill', coworkSkillSchema)
  );
}
