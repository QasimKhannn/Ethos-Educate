// cowork — Phase 2: tests for the self-contained cron utility.
const { validateCron, getNextRun } = require('./coworkCron');

describe('coworkCron.validateCron', () => {
  test.each([
    '* * * * *',
    '0 9 * * *',
    '*/15 * * * *',
    '0 0 1 * *',
    '0 12 * * MON',
    '0 8 * * 1-5',
    '30 6 1,15 * *',
    '0 0 1 JAN *',
    '0 9 * * 0',
    '0 9 * * 7', // 7 == Sunday
    '0-30/10 * * * *',
  ])('accepts valid expression %s', (expr) => {
    expect(validateCron(expr).valid).toBe(true);
  });

  test.each([
    '',
    '* * * *', // too few fields
    '* * * * * *', // too many fields
    '60 * * * *', // minute out of range
    '* 24 * * *', // hour out of range
    '* * 0 * *', // day-of-month out of range
    '* * * 13 *', // month out of range
    '* * * * 8', // day-of-week out of range
    '*/0 * * * *', // zero step
    '5-1 * * * *', // inverted range
    'abc * * * *', // garbage
  ])('rejects invalid expression %s', (expr) => {
    expect(validateCron(expr).valid).toBe(false);
  });
});

describe('coworkCron.getNextRun', () => {
  test('every minute → next whole minute', () => {
    const from = new Date('2026-06-19T10:15:30');
    const next = getNextRun('* * * * *', from);
    expect(next.toISOString().slice(0, 16)).toBe(new Date('2026-06-19T10:16:00').toISOString().slice(0, 16));
  });

  test('daily at 09:00 — later same day', () => {
    const from = new Date('2026-06-19T07:00:00');
    const next = getNextRun('0 9 * * *', from);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDate()).toBe(19);
  });

  test('daily at 09:00 — rolls to next day when already past', () => {
    const from = new Date('2026-06-19T10:00:00');
    const next = getNextRun('0 9 * * *', from);
    expect(next.getHours()).toBe(9);
    expect(next.getDate()).toBe(20);
  });

  test('*/15 steps to the next quarter hour', () => {
    const from = new Date('2026-06-19T10:07:00');
    const next = getNextRun('*/15 * * * *', from);
    expect(next.getMinutes()).toBe(15);
  });

  test('weekday-only (MON-FRI) skips the weekend', () => {
    // 2026-06-20 is a Saturday; 09:00 MON-FRI from Friday eve → Monday 22nd.
    const from = new Date('2026-06-19T10:00:00'); // Friday
    const next = getNextRun('0 9 * * 1-5', from);
    expect(next.getDay()).toBe(1); // Monday
    expect(next.getDate()).toBe(22);
  });

  test('strictly after — never returns the reference minute itself', () => {
    const from = new Date('2026-06-19T09:00:00');
    const next = getNextRun('0 9 * * *', from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  test('result has zeroed seconds and milliseconds', () => {
    const next = getNextRun('* * * * *', new Date('2026-06-19T10:15:42.500'));
    expect(next.getSeconds()).toBe(0);
    expect(next.getMilliseconds()).toBe(0);
  });
});
