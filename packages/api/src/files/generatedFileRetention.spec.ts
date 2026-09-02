import {
  DEFAULT_GENERATED_FILE_CLEANUP_INTERVAL_MINUTES,
  DEFAULT_GENERATED_FILE_RETENTION_MINUTES,
  formatGeneratedFileRetentionDuration,
  getGeneratedFileCleanupIntervalMinutes,
  getGeneratedFileRetentionExpiry,
  getGeneratedFileRetentionMinutes,
} from './generatedFileRetention';

const originalRetentionMinutes = process.env.GENERATED_FILE_RETENTION_MINUTES;
const originalCleanupIntervalMinutes = process.env.GENERATED_FILE_CLEANUP_INTERVAL_MINUTES;

afterEach(() => {
  if (originalRetentionMinutes === undefined) {
    delete process.env.GENERATED_FILE_RETENTION_MINUTES;
  } else {
    process.env.GENERATED_FILE_RETENTION_MINUTES = originalRetentionMinutes;
  }

  if (originalCleanupIntervalMinutes === undefined) {
    delete process.env.GENERATED_FILE_CLEANUP_INTERVAL_MINUTES;
  } else {
    process.env.GENERATED_FILE_CLEANUP_INTERVAL_MINUTES = originalCleanupIntervalMinutes;
  }
});

describe('generated file retention configuration', () => {
  test('uses the current 24-hour and hourly defaults when unset', () => {
    delete process.env.GENERATED_FILE_RETENTION_MINUTES;
    delete process.env.GENERATED_FILE_CLEANUP_INTERVAL_MINUTES;

    expect(getGeneratedFileRetentionMinutes()).toBe(DEFAULT_GENERATED_FILE_RETENTION_MINUTES);
    expect(getGeneratedFileCleanupIntervalMinutes()).toBe(
      DEFAULT_GENERATED_FILE_CLEANUP_INTERVAL_MINUTES,
    );
    expect(getGeneratedFileRetentionExpiry(Date.UTC(2026, 8, 2, 12)).toISOString()).toBe(
      '2026-09-03T12:00:00.000Z',
    );
    expect(formatGeneratedFileRetentionDuration()).toBe('24 hours');
  });

  test('uses configured positive minute values for expiry and cleanup', () => {
    process.env.GENERATED_FILE_RETENTION_MINUTES = '5';
    process.env.GENERATED_FILE_CLEANUP_INTERVAL_MINUTES = '2';

    expect(getGeneratedFileRetentionMinutes()).toBe(5);
    expect(getGeneratedFileCleanupIntervalMinutes()).toBe(2);
    expect(getGeneratedFileRetentionExpiry(Date.UTC(2026, 8, 2, 12)).toISOString()).toBe(
      '2026-09-02T12:05:00.000Z',
    );
    expect(formatGeneratedFileRetentionDuration()).toBe('5 minutes');
  });

  test.each(['0', '-1', '1.5', 'invalid'])('rejects invalid retention values: %s', (value) => {
    process.env.GENERATED_FILE_RETENTION_MINUTES = value;
    expect(() => getGeneratedFileRetentionMinutes()).toThrow(
      'GENERATED_FILE_RETENTION_MINUTES must be a positive integer.',
    );
  });

  test.each(['0', '-1', '1.5', 'invalid'])('rejects invalid cleanup intervals: %s', (value) => {
    process.env.GENERATED_FILE_CLEANUP_INTERVAL_MINUTES = value;
    expect(() => getGeneratedFileCleanupIntervalMinutes()).toThrow(
      'GENERATED_FILE_CLEANUP_INTERVAL_MINUTES must be a positive integer.',
    );
  });
});
