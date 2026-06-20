// cowork
import coworkRoutineSchema, { IMongoCoworkRoutine } from '~/schema/coworkRoutine';

/**
 * Creates or returns the CoworkRoutine model. Separate collection — scheduled automations.
 */
export function createCoworkRoutineModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.CoworkRoutine ||
    mongoose.model<IMongoCoworkRoutine>('CoworkRoutine', coworkRoutineSchema)
  );
}
