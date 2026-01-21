import { format as formatDate, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Italy Timezone constant
 * Europe/Rome handles both CET (UTC+1) and CEST (UTC+2) automatically
 */
const ITALY_TIMEZONE = 'Europe/Rome';

/**
 * Format a date in Italy timezone
 * @param {Date|string} date - Date object or ISO string
 * @param {string} formatString - Format string (e.g., 'dd/MM HH:mm', 'yyyy-MM-dd')
 * @returns {string} Formatted date string in Italy timezone
 */
export function formatInItalyTimezone(date, formatString = 'dd/MM HH:mm') {
  try {
    // Handle null/undefined
    if (!date) return '—';
    
    // Convert string to Date if needed
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Format in Italy timezone
    return formatInTimeZone(dateObj, ITALY_TIMEZONE, formatString);
  } catch (error) {
    console.error('Error formatting date in Italy timezone:', error);
    return '—';
  }
}

/**
 * Parse a date from Italy timezone and convert to UTC Date object
 * Useful for parsing user input that's in Italy time
 * @param {string} dateString - Date string in Italy timezone
 * @param {string} formatString - Format string used to parse
 * @returns {Date} UTC Date object
 */
export function parseFromItalyTimezone(dateString, formatString = 'dd/MM/yyyy HH:mm') {
  try {
    // Create a date in Italy timezone
    const zonedDate = toZonedTime(dateString, ITALY_TIMEZONE);
    return zonedDate;
  } catch (error) {
    console.error('Error parsing date from Italy timezone:', error);
    return new Date();
  }
}

/**
 * Format scheduled start/end times consistently
 * @param {string} isoString - ISO datetime string from database (UTC)
 * @returns {string} Formatted string in Italian timezone (dd/MM HH:mm)
 */
export function formatScheduledTime(isoString) {
  return formatInItalyTimezone(isoString, 'dd/MM HH:mm');
}

/**
 * Format delivery dates
 * @param {string} isoString - ISO date string (UTC)
 * @returns {string} Formatted string in Italian timezone (dd/MM/yyyy)
 */
export function formatDeliveryDate(isoString) {
  return formatInItalyTimezone(isoString, 'dd/MM/yyyy');
}
