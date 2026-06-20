// cowork
import coworkProjectSchema, { IMongoCoworkProject } from '~/schema/coworkProject';

/**
 * Creates or returns the CoworkProject model. Separate collection from Project.
 */
export function createCoworkProjectModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.CoworkProject ||
    mongoose.model<IMongoCoworkProject>('CoworkProject', coworkProjectSchema)
  );
}
