/**
 * Month calculation utilities
 * Used for farmer monthly availability submissions
 */

/**
 * Get the start date of the current month (1st at 00:00:00)
 */
export function getMonthStartDate(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the last day of the month (23:59:59)
 */
export function getMonthEndDate(date: Date = new Date()): Date {
  const first = getMonthStartDate(date);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  last.setHours(23, 59, 59, 999);
  return last;
}

/**
 * Submission window: first 5 days of the month (1st 00:00 through 5th 23:59:59)
 */
export function isWithinMonthlySubmissionWindow(date: Date = new Date()): boolean {
  const d = new Date(date);
  const monthStart = getMonthStartDate(d);
  const dayOfMonth = d.getDate();
  if (dayOfMonth > 5) return false;
  return d >= monthStart;
}

/**
 * Check if submission is late (submitted after 5th 23:59:59 of that month)
 */
export function isLateMonthlySubmission(
  submissionDate: Date,
  monthStartDate: Date
): boolean {
  const fifthEnd = new Date(monthStartDate);
  fifthEnd.setDate(5);
  fifthEnd.setHours(23, 59, 59, 999);
  return submissionDate > fifthEnd;
}

/**
 * Get month start for a given date (1st of that month)
 */
export function getMonthStartForDate(date: Date): Date {
  return getMonthStartDate(date);
}

/**
 * Format month range as string (e.g., "January 2024")
 */
export function formatMonthRange(monthStartDate: Date): string {
  return monthStartDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
