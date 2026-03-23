/**
 * Calendar and Scheduling Constants
 * Centralized constants for time slots, work hours, and calendar calculations
 */

export const CALENDAR_CONSTANTS = {
  // Work hours (in CET timezone)
  WORK_START_HOUR: 6,  // 6:00 AM CET
  WORK_END_HOUR: 22,   // 10:00 PM CET
  
  // Time slot configuration
  MINUTES_PER_SLOT: 15,
  SLOTS_PER_HOUR: 4,
  
  // Derived calculations
  get WORK_HOURS() {
    return this.WORK_END_HOUR - this.WORK_START_HOUR; // 16 hours
  },
  
  get TOTAL_SLOTS() {
    return this.WORK_HOURS * this.SLOTS_PER_HOUR; // 64 slots
  },
  
  get SLOT_WIDTH_PX() {
    return 15; // pixels per slot in Gantt chart
  },
  
  get TOTAL_WIDTH_PX() {
    return this.TOTAL_SLOTS * this.SLOT_WIDTH_PX; // 960px
  },
};


/**
 * Check if hour is within work hours
 * @param {number} hour - Hour to check (0-23)
 * @returns {boolean} True if within work hours
 */
export function isWithinWorkHours(hour) {
  return hour >= CALENDAR_CONSTANTS.WORK_START_HOUR && hour < CALENDAR_CONSTANTS.WORK_END_HOUR;
}

/**
 * Clamp hour to work hour range
 * @param {number} hour - Hour to clamp (0-23)
 * @returns {number} Clamped hour
 */
export function clampHour(hour) {
  return Math.max(CALENDAR_CONSTANTS.WORK_START_HOUR, Math.min(hour, CALENDAR_CONSTANTS.WORK_END_HOUR));
}
