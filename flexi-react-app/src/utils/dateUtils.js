/**
 * Date utility functions for consistent date handling
 * Avoids timezone conversion issues by working with local dates
 */

/**
 * Convert a Date object to a date string in YYYY-MM-DD format
 * Uses local date to avoid timezone conversion issues
 */
export function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Create a date string from year, month, and day
 * Uses local date to ensure consistency
 */
export function createDateString(year, month, day) {
  const date = new Date(year, month, day);
  return toDateString(date);
}

/**
 * Check if a task overlaps with a specific date and hour
 * Handles date comparison properly without timezone issues
 */
export function isTaskOverlapping(task, dateStr, hour) {
  const taskStart = new Date(task.scheduled_start_time);
  const taskEnd = new Date(task.scheduled_end_time);
  
  // Create slot boundaries using the dateStr directly
  const slotStart = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:00:00`);
  const slotEnd = new Date(`${dateStr}T${(hour + 1).toString().padStart(2, '0')}:00:00`);
  
  // Debug logging for the first few hours
  if (hour < 3) {
    console.log(`DateUtils: Checking overlap for ${dateStr} hour ${hour}`);
    console.log(`DateUtils: Task start: ${taskStart.toISOString()} (local: ${taskStart.toLocaleString()})`);
    console.log(`DateUtils: Task end: ${taskEnd.toISOString()} (local: ${taskEnd.toLocaleString()})`);
    console.log(`DateUtils: Slot start: ${slotStart.toISOString()} (local: ${slotStart.toLocaleString()})`);
    console.log(`DateUtils: Slot end: ${slotEnd.toISOString()} (local: ${slotEnd.toLocaleString()})`);
    console.log(`DateUtils: Overlap: ${taskStart < slotEnd && taskEnd > slotStart}`);
  }
  
  // Check if the task overlaps with this hour slot
  return taskStart < slotEnd && taskEnd > slotStart;
}

/**
 * Get the local date string for a given date object
 * Ensures consistent date handling across the application
 */
export function getLocalDateString(date) {
  return toDateString(date);
}

/**
 * Parse a date string and return a Date object
 * Handles various date string formats consistently
 */
export function parseDateString(dateStr) {
  // If it's already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  
  // Otherwise, try to parse it
  return new Date(dateStr);
}
