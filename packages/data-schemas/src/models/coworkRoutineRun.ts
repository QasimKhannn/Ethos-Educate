// cowork
import coworkRoutineRunSchema, { IMongoCoworkRoutineRun } from '~/schema/coworkRoutineRun';

/**
 * Creates or returns the CoworkRoutineRun model. Separate collection — per-run history for routines.
 */
export function createCoworkRoutineRunModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.CoworkRoutineRun ||
    mongoose.model<IMongoCoworkRoutineRun>('CoworkRoutineRun', coworkRoutineRunSchema)
  );
}
