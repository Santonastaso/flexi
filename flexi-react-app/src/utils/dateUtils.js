/**
 * Robust date utility functions using date-fns library
 * Provides reliable date handling for scheduling applications
 */

import * as dateFns from 'date-fns';

/**
 * Convert a Date object to a date string in YYYY-MM-DD format
 * Uses date-fns for consistent formatting
 */
export function toDateString(date) {
  return dateFns.format(date, 'yyyy-MM-dd');
}

/**
 * Create a date string from year, month, and day
 * Uses date-fns for reliable date construction
 */
export function createDateString(year, month, day) {
  const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
  return toDateString(date);
}

/**
 * Parse a date string and return a Date object
 * Uses date-fns parseISO for reliable parsing
 */
export function parseDateString(dateStr) {
  if (typeof dateStr === 'string') {
    return dateFns.parseISO(dateStr);
  }
  return dateStr;
}

/**
 * Check if a task overlaps with a specific date and hour
 * Uses date-fns for reliable date comparison
 */
export function isTaskOverlapping(task, dateStr, hour) {
  if (!task.scheduled_start_time || !task.scheduled_end_time) {
    return false;
  }

  const taskStart = dateFns.parseISO(task.scheduled_start_time);
  const taskEnd = dateFns.parseISO(task.scheduled_end_time);
  
  // Create slot boundaries using the dateStr directly
  const slotStart = dateFns.setMilliseconds(dateFns.setSeconds(dateFns.setMinutes(dateFns.setHours(dateFns.parseISO(dateStr), hour), 0), 0), 0);
  const slotEnd = dateFns.setMilliseconds(dateFns.setSeconds(dateFns.setMinutes(dateFns.setHours(dateFns.parseISO(dateStr), hour + 1), 0), 0), 0);
  
  // Check if the task overlaps with this hour slot
  return dateFns.isBefore(taskStart, slotEnd) && dateFns.isAfter(taskEnd, slotStart);
}

/**
 * Get the start of week for a given date
 * Uses date-fns for reliable week calculation
 */
export function getStartOfWeek(date) {
  return dateFns.startOfWeek(date, { weekStartsOn: 0 }); // Sunday = 0
}

/**
 * Get the end of week for a given date
 * Uses date-fns for reliable week calculation
 */
export function getEndOfWeek(date) {
  return dateFns.endOfWeek(date, { weekStartsOn: 0 }); // Sunday = 0
}

/**
 * Get the start of day for a given date
 * Uses date-fns for reliable day boundary calculation
 */
export function getStartOfDay(date) {
  return dateFns.startOfDay(date);
}

/**
 * Get the end of day for a given date
 * Uses date-fns for reliable day boundary calculation
 */
export function getEndOfDay(date) {
  return dateFns.endOfDay(date);
}

// UTC-specific day boundaries for absolute-time rendering
export function getUTCStartOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function getUTCEndOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/**
 * Check if two dates are the same day
 * Uses date-fns for reliable comparison
 */
export function isSameDate(date1, date2) {
  return dateFns.isSameDay(date1, date2);
}

export function isSameUTCDate(date1, date2) {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Add hours to a date
 * Uses date-fns for reliable date arithmetic
 */
export function addHoursToDate(date, hours) {
  return dateFns.addHours(date, hours);
}

/**
 * Add days to a date
 * Uses date-fns for reliable date arithmetic
 */
export function addDaysToDate(date, days) {
  return dateFns.addDays(date, days);
}

/**
 * Format a date for display
 * Uses date-fns for consistent formatting
 */
export function formatDate(date, formatStr = 'yyyy-MM-dd') {
  return dateFns.format(date, formatStr);
}

/**
 * Format a date and time for display
 * Uses date-fns for consistent formatting
 */
export function formatDateTime(date, formatStr = 'yyyy-MM-dd HH:mm') {
  return dateFns.format(date, formatStr);
}

/**
 * Get the difference in hours between two dates
 * Uses date-fns for reliable calculation
 */
export function getHoursDifference(date1, date2) {
  return dateFns.differenceInHours(date2, date1);
}

/**
 * Get the difference in minutes between two dates
 * Uses date-fns for reliable calculation
 */
export function getMinutesDifference(date1, date2) {
  return dateFns.differenceInMinutes(date2, date1);
}

/**
 * Check if a date is within a given interval
 * Uses date-fns for reliable interval checking
 */
export function isDateInInterval(date, start, end) {
  return dateFns.isWithinInterval(date, { start, end });
}

/**
 * Create a date from individual components
 * Uses native Date constructor and date-fns for reliable date construction
 */
export function createDate(year, month, day, hour = 0, minute = 0, second = 0) {
  let date = new Date(year, month - 1, day); // month is 0-indexed
  date = dateFns.setHours(date, hour);
  date = dateFns.setMinutes(date, minute);
  date = dateFns.setSeconds(date, second);
  date = dateFns.setMilliseconds(date, 0);
  return date;
}

/**
 * Get the current date in YYYY-MM-DD format
 * Uses date-fns for consistent formatting
 */
export function getCurrentDateString() {
  return toDateString(new Date());
}

/**
 * Get the current date and time in ISO format
 * Uses date-fns for consistent formatting
 */
export function getCurrentDateTimeString() {
  return new Date().toISOString();
}

/**
 * Get hours from a date in local time
 * Uses date-fns for consistent time extraction
 */
export function getHours(date) {
  return dateFns.getHours(date);
}

/**
 * Get minutes from a date in local time
 * Uses date-fns for consistent time extraction
 */
export function getMinutes(date) {
  return dateFns.getMinutes(date);
}
