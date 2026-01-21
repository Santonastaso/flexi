import { format as formatDate, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { AppConfig } from '../services/config';

/**
 * Italy Timezone constant - use centralized config
 * Europe/Rome handles both CET (UTC+1) and CEST (UTC+2) automatically
 */
export const ITALY_TIMEZONE = AppConfig.APP.TIMEZONE;

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

/**
 * Convert a CET hour on a specific date to UTC
 * Reusable utility to avoid duplication of the 4-step conversion process
 * 
 * @param {string} dateStr - Date string in 'yyyy-MM-dd' format
 * @param {number} cetHour - Hour in CET timezone (0-23)
 * @returns {Date} UTC Date object representing that CET hour
 */
export function convertCETHourToUTC(dateStr, cetHour) {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Step 1: Create base UTC date for the start of this day
  const baseDateUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  
  // Step 2: Convert to Europe/Rome timezone to get midnight in CET
  const dateInRome = toZonedTime(baseDateUTC, ITALY_TIMEZONE);
  
  // Step 3: Set the hour in CET time
  dateInRome.setHours(cetHour, 0, 0, 0);
  
  // Step 4: Convert back from CET to UTC
  return fromZonedTime(dateInRome, ITALY_TIMEZONE);
}

/**
 * Get today's date in CET timezone as a UTC Date object
 * Returns a Date representing midnight CET of the current CET day
 * 
 * @returns {Date} UTC Date object representing midnight of today in CET
 */
export function getTodayInCET() {
  const now = new Date();
  const nowInCET = toZonedTime(now, ITALY_TIMEZONE);
  // Create a UTC date object representing midnight CET on the current CET day
  return new Date(Date.UTC(nowInCET.getFullYear(), nowInCET.getMonth(), nowInCET.getDate()));
}

/**
 * Convert a UTC date to its CET day representation
 * Returns a Date representing midnight CET of the date's CET day
 * 
 * @param {Date} utcDate - UTC Date object
 * @returns {Date} UTC Date object representing midnight CET of that day
 */
export function getDateInCET(utcDate) {
  const dateInCET = toZonedTime(utcDate, ITALY_TIMEZONE);
  return new Date(Date.UTC(dateInCET.getFullYear(), dateInCET.getMonth(), dateInCET.getDate()));
}
