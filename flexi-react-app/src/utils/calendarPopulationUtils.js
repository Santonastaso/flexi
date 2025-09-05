/**
 * Calendar Population Utilities
 * Generates machine availability records based on business rules
 */

import { WORK_CENTERS, DEPARTMENT_TYPES } from '../constants.js';
import { format, getDay, startOfYear, endOfYear, addDays, isAfter, isSameDay } from 'date-fns';

/**
 * This function generates all unavailable hours for a given machine and day based on rules
 * @param {Object} machine - The machine object with work_center, department, and active_shifts
 * @param {Date} date - The date to generate availability for
 * @returns {Array<string>} Array of unavailable hours as strings
 */
function getUnavailableHours(machine, date) {
    const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
    const unavailable = new Set();

    // Rule 1: Weekends are always off
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        for (let i = 0; i < 24; i++) unavailable.add(i.toString());
        return Array.from(unavailable);
    }

    // Start with all hours being unavailable
    for (let i = 0; i < 24; i++) {
        unavailable.add(i.toString());
    }

    const { work_center, department, active_shifts = [] } = machine;

    // Remove hours from the unavailable set based on active shifts (making them available)
    active_shifts.forEach(shift => {
        if (shift === 'T3') { // 24/5 availability
            unavailable.clear();
            return;
        }

        if (shift === 'T2') {
            // All locations: 6:00 - 22:00 is available
            for (let i = 6; i < 22; i++) unavailable.delete(i.toString());
        }

        if (shift === 'T1') {
            if (work_center === WORK_CENTERS.BUSTO_GAROLFO) {
                for (let i = 8; i < 12; i++) unavailable.delete(i.toString());  // 8:00 - 12:00
                for (let i = 14; i < 18; i++) unavailable.delete(i.toString()); // 14:00 - 18:00
            } else if (work_center === WORK_CENTERS.ZANICA) {
                if (department === DEPARTMENT_TYPES.PACKAGING) { // Confezionamento
                    for (let i = 8; i < 12; i++) unavailable.delete(i.toString());  // 8:00 - 12:00
                    for (let i = 13; i < 17; i++) unavailable.delete(i.toString()); // 12:30-16:30 -> treat as 13:00-17:00
                } else { // Stampa
                    for (let i = 8; i < 12; i++) unavailable.delete(i.toString());  // 8:00 - 12:00
                    for (let i = 13; i < 17; i++) unavailable.delete(i.toString()); // 13:00 - 17:00
                }
            }
        }
    });

    return Array.from(unavailable).sort((a, b) => parseInt(a) - parseInt(b));
}

/**
 * Generates all machine_availability records for a list of machines for a specific year.
 * @param {Array} machines - The list of machine objects.
 * @param {number} year - The year to generate the calendar for.
 * @returns {Array} An array of records ready for database insertion.
 */
export function generateCalendarForYear(machines, year) {
    const records = [];
    const startDate = startOfYear(new Date(year, 0, 1));
    const endDate = endOfYear(new Date(year, 11, 31));

    for (const machine of machines) {
        let currentDate = new Date(startDate);
        while (!isAfter(currentDate, endDate)) {
            const unavailable_hours = getUnavailableHours(machine, currentDate);
            if (unavailable_hours.length > 0) { // Only insert if there are unavailable hours
                records.push({
                    machine_id: machine.id,
                    date: format(currentDate, 'yyyy-MM-dd'),
                    unavailable_hours: unavailable_hours,
                });
            }
            currentDate = addDays(currentDate, 1);
        }
    }
    return records;
}

/**
 * Generates machine_availability records for a single machine for a specific year.
 * @param {Object} machine - The machine object.
 * @param {number} year - The year to generate the calendar for.
 * @returns {Array} An array of records ready for database insertion.
 */
export function generateCalendarForMachine(machine, year) {
    return generateCalendarForYear([machine], year);
}
