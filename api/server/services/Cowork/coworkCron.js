// cowork — Phase 2: a tiny, dependency-free cron utility for the Routines scheduler.
//
// Why hand-rolled (not `cron-parser`/`croner`): the project has no cron library installed and this
// folder is OneDrive-synced, which makes `npm install` flaky. Routines only need standard 5-field
// cron, so we parse that subset ourselves and keep the surface area tiny and testable.
//
// Supported syntax (standard 5 fields): "minute hour day-of-month month day-of-week"
//   - `*`            any value
//   - `5`            a single value
//   - `1,15,30`      a list
//   - `1-5`          a range (inclusive)
//   - `*/15`         a step over the whole range
//   - `1-30/5`       a step over a range
//   - named months   JAN..DEC (case-insensitive)
//   - named weekdays  SUN..SAT (case-insensitive); both 0 and 7 mean Sunday
//
// All times are evaluated in the server's local timezone (matches `new Date()` everywhere else in
// the routine runner). Seconds are not supported — the smallest granularity is one minute.

const FIELD_BOUNDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'dayOfMonth', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'dayOfWeek', min: 0, max: 6 }, // 0 = Sunday (7 normalized to 0)
];

const MONTH_NAMES = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const DAY_NAMES = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/** Resolve a token to an integer, honoring named months/weekdays for the relevant fields. */
function resolveToken(token, fieldIndex) {
  const upper = String(token).toUpperCase();
  if (fieldIndex === 3 && MONTH_NAMES[upper] !== undefined) {
    return MONTH_NAMES[upper];
  }
  if (fieldIndex === 4 && DAY_NAMES[upper] !== undefined) {
    return DAY_NAMES[upper];
  }
  if (!/^\d+$/.test(token)) {
    throw new Error(`Invalid value "${token}"`);
  }
  return parseInt(token, 10);
}

/**
 * Parse one cron field into a Set of allowed integer values.
 * @throws if the field is malformed or out of range.
 */
function parseField(field, fieldIndex) {
  const { name, min, max } = FIELD_BOUNDS[fieldIndex];
  const allowed = new Set();

  for (const part of String(field).split(',')) {
    const piece = part.trim();
    if (piece === '') {
      throw new Error(`Empty value in ${name} field`);
    }

    // Split off an optional step: "<range>/<step>".
    let rangePart = piece;
    let step = 1;
    if (piece.includes('/')) {
      const [rangeStr, stepStr] = piece.split('/');
      if (stepStr === undefined || !/^\d+$/.test(stepStr) || parseInt(stepStr, 10) === 0) {
        throw new Error(`Invalid step in ${name} field: "${piece}"`);
      }
      step = parseInt(stepStr, 10);
      rangePart = rangeStr;
    }

    let start;
    let end;
    if (rangePart === '*') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      start = resolveToken(a, fieldIndex);
      end = resolveToken(b, fieldIndex);
    } else {
      start = resolveToken(rangePart, fieldIndex);
      // A bare value with a step (e.g. "5/10") runs from the value to the field max.
      end = piece.includes('/') ? max : start;
    }

    // Normalize Sunday-as-7 for the day-of-week field.
    if (fieldIndex === 4) {
      if (start === 7) {
        start = 0;
      }
      if (end === 7) {
        end = 0;
      }
    }

    if (start < min || start > max || end < min || end > max) {
      throw new Error(`Value out of range (${min}-${max}) in ${name} field: "${piece}"`);
    }
    if (start > end) {
      throw new Error(`Range start after end in ${name} field: "${piece}"`);
    }

    for (let v = start; v <= end; v += step) {
      allowed.add(v);
    }
  }

  return allowed;
}

/**
 * Parse a full cron expression into per-field Sets.
 * @returns {{minute:Set, hour:Set, dayOfMonth:Set, month:Set, dayOfWeek:Set,
 *            domRestricted:boolean, dowRestricted:boolean}}
 * @throws on any malformed expression.
 */
function parseCron(expression) {
  if (typeof expression !== 'string' || expression.trim() === '') {
    throw new Error('Cron expression is empty');
  }
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Cron expression must have 5 fields, got ${fields.length}`);
  }

  return {
    minute: parseField(fields[0], 0),
    hour: parseField(fields[1], 1),
    dayOfMonth: parseField(fields[2], 2),
    month: parseField(fields[3], 3),
    dayOfWeek: parseField(fields[4], 4),
    // Standard cron: when both day-of-month and day-of-week are restricted (not "*"),
    // a match on EITHER fires. Track which fields were restricted.
    domRestricted: fields[2].trim() !== '*',
    dowRestricted: fields[4].trim() !== '*',
  };
}

/**
 * Validate a cron expression.
 * @param {string} expression
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCron(expression) {
  try {
    parseCron(expression);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/** Does a given Date satisfy the parsed cron's day constraints? */
function matchesDay(parsed, date) {
  const domMatch = parsed.dayOfMonth.has(date.getDate());
  const dowMatch = parsed.dayOfWeek.has(date.getDay());

  if (parsed.domRestricted && parsed.dowRestricted) {
    // Both restricted → OR semantics (standard cron behavior).
    return domMatch || dowMatch;
  }
  if (parsed.domRestricted) {
    return domMatch;
  }
  if (parsed.dowRestricted) {
    return dowMatch;
  }
  return true; // both are "*"
}

/**
 * Compute the next fire time strictly after `from`.
 * @param {string} expression - a 5-field cron expression.
 * @param {Date} [from] - reference time (defaults to now).
 * @returns {Date} the next matching minute (with seconds/ms zeroed).
 * @throws if the expression is invalid.
 */
function getNextRun(expression, from = new Date()) {
  const parsed = parseCron(expression);

  // Start from the next whole minute after `from`.
  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Walk forward minute by minute. Cap the search at ~5 years of minutes so a pathological
  // (but valid) expression like "0 0 31 2 *" (Feb 31 — never) terminates instead of looping forever.
  const MAX_ITERATIONS = 5 * 366 * 24 * 60;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (
      parsed.month.has(candidate.getMonth() + 1) &&
      matchesDay(parsed, candidate) &&
      parsed.hour.has(candidate.getHours()) &&
      parsed.minute.has(candidate.getMinutes())
    ) {
      return new Date(candidate.getTime());
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(`Cron expression "${expression}" has no upcoming run within 5 years`);
}

/**
 * Estimate the smallest gap (in minutes) between consecutive fires of a cron expression, by
 * sampling the next several occurrences. Used to reject schedules that fire too frequently.
 * @param {string} expression
 * @param {Date} [from]
 * @param {number} [samples] - how many consecutive occurrences to inspect (default 6).
 * @returns {number} smallest gap in minutes (Infinity if fewer than two fires are found).
 */
function getMinGapMinutes(expression, from = new Date(), samples = 6) {
  let prev = getNextRun(expression, from);
  let minGapMs = Infinity;
  for (let i = 0; i < samples; i++) {
    const next = getNextRun(expression, prev);
    minGapMs = Math.min(minGapMs, next.getTime() - prev.getTime());
    prev = next;
  }
  return minGapMs === Infinity ? Infinity : minGapMs / 60000;
}

module.exports = { validateCron, getNextRun, parseCron, getMinGapMinutes };
