/**
 * Week calculation utilities
 * Used for farmer availability submissions
 */

/**
 * Get the start date of the current week (Monday)
 * @returns Date object representing Monday 00:00:00 of current week
 */
export function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get the end date of the current week (Sunday 23:59:59)
 * @returns Date object representing Sunday 23:59:59 of current week
 */
export function getWeekEndDate(date: Date = new Date()): Date {
  const monday = getWeekStartDate(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Check if current date is within submission window (Monday-Tuesday)
 * Submission window: Monday 00:00:00 to Tuesday 23:59:59
 * @param date Optional date to check (defaults to now)
 * @returns true if within submission window, false otherwise
 */
export function isWithinSubmissionWindow(date: Date = new Date()): boolean {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Monday = 1, Tuesday = 2
  return day === 1 || day === 2;
}

/**
 * Check if submission is late (submitted after Tuesday 23:59:59)
 * @param submissionDate Date when submission was made
 * @param weekStartDate Monday of the week being submitted for
 * @returns true if late, false otherwise
 */
export function isLateSubmission(
  submissionDate: Date,
  weekStartDate: Date
): boolean {
  const weekMonday = getWeekStartDate(weekStartDate);
  const tuesdayEnd = new Date(weekMonday);
  tuesdayEnd.setDate(tuesdayEnd.getDate() + 1); // Tuesday
  tuesdayEnd.setHours(23, 59, 59, 999);
  
  return submissionDate > tuesdayEnd;
}

/**
 * Get week start date for a specific date (Monday of that week)
 * @param date Date to get week start for
 * @returns Date object representing Monday 00:00:00
 */
export function getWeekStartForDate(date: Date): Date {
  return getWeekStartDate(date);
}

/**
 * Format week range as string (e.g., "Jan 1 - Jan 7, 2024")
 */
export function formatWeekRange(weekStartDate: Date): string {
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const startStr = weekStartDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = weekEnd.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  return `${startStr} - ${endStr}`;
}







