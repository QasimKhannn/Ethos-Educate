export const DEFAULT_GENERATED_FILE_RETENTION_MINUTES = 24 * 60;
export const DEFAULT_GENERATED_FILE_CLEANUP_INTERVAL_MINUTES = 60;

function getPositiveIntegerEnvironmentValue(name: string, fallback: number): number {
  const configured = process.env[name];
  if (configured === undefined) {
    return fallback;
  }

  const value = Number(configured);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

export function getGeneratedFileRetentionMinutes(): number {
  return getPositiveIntegerEnvironmentValue(
    'GENERATED_FILE_RETENTION_MINUTES',
    DEFAULT_GENERATED_FILE_RETENTION_MINUTES,
  );
}

export function getGeneratedFileCleanupIntervalMinutes(): number {
  return getPositiveIntegerEnvironmentValue(
    'GENERATED_FILE_CLEANUP_INTERVAL_MINUTES',
    DEFAULT_GENERATED_FILE_CLEANUP_INTERVAL_MINUTES,
  );
}

export function getGeneratedFileRetentionExpiry(now: number = Date.now()): Date {
  return new Date(now + getGeneratedFileRetentionMinutes() * 60 * 1000);
}

export function formatGeneratedFileRetentionDuration(
  minutes: number = getGeneratedFileRetentionMinutes(),
): string {
  if (minutes % (7 * 24 * 60) === 0) {
    const weeks = minutes / (7 * 24 * 60);
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
