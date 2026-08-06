import type { TProject } from 'librechat-data-provider';
import type { RankableProject } from '../projectNavigation';
import { rankProjects } from '../projectNavigation';

const createProject = (
  id: string,
  name: string,
  isFavorite: boolean,
  lastWorkedAt?: string,
): RankableProject => ({
  isFavorite,
  lastWorkedAt,
  project: { _id: id, name } satisfies TProject,
});

describe('rankProjects', () => {
  it('puts favorites first and orders each group by latest activity', () => {
    const projects = [
      createProject('recent', 'Recent', false, '2026-08-06T10:00:00.000Z'),
      createProject('favorite-old', 'Favorite old', true, '2026-08-01T10:00:00.000Z'),
      createProject('older', 'Older', false, '2026-08-03T10:00:00.000Z'),
      createProject('favorite-new', 'Favorite new', true, '2026-08-05T10:00:00.000Z'),
    ];

    expect(rankProjects(projects).map(({ project }) => project._id)).toEqual([
      'favorite-new',
      'favorite-old',
      'recent',
      'older',
    ]);
  });

  it('falls back to project timestamps and then project name', () => {
    const projects = [
      createProject('zulu', 'Zulu', false),
      {
        ...createProject('updated', 'Updated', false),
        project: {
          _id: 'updated',
          name: 'Updated',
          updatedAt: '2026-08-04T10:00:00.000Z',
        },
      },
      createProject('alpha', 'Alpha', false, 'not-a-date'),
    ];

    expect(rankProjects(projects).map(({ project }) => project._id)).toEqual([
      'updated',
      'alpha',
      'zulu',
    ]);
  });

  it('does not mutate the source collection', () => {
    const projects = [
      createProject('older', 'Older', false, '2026-08-01T10:00:00.000Z'),
      createProject('recent', 'Recent', false, '2026-08-06T10:00:00.000Z'),
    ];

    rankProjects(projects);

    expect(projects.map(({ project }) => project._id)).toEqual(['older', 'recent']);
  });
});
