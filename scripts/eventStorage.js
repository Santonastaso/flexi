/**
 * Event Storage - Handles off-time periods, scheduled events, and data persistence
 * Integrates with existing storage service for backward compatibility
 */
class EventStorage {
    constructor() {
        this.storageService = window.storageService;
        this.eventTypes = {
            OFF_TIME: 'off-time',
            SCHEDULED: 'scheduled',
            MAINTENANCE: 'maintenance'
        };
    }
    
    /**
     * Get all events for a specific date
     */
    getEventsForDate(machineName, dateStr) {
        if (!machineName) return [];
        
        const events = [];
        
        // Get off-time periods
        const offTimeEvents = this.getOffTimeEventsForDate(machineName, dateStr);
        events.push(...offTimeEvents);
        
        // Get scheduled events (from existing system)
        const scheduledEvents = this.getScheduledEventsForDate(machineName, dateStr);
        events.push(...scheduledEvents);
        
        return events;
    }
    
    /**
     * Get events for a specific date and hour
     */
    getEventsForDateTime(machineName, dateStr, hour) {
        const allEvents = this.getEventsForDate(machineName, dateStr);
        return allEvents.filter(event => 
            hour >= event.startHour && hour < event.endHour
        );
    }
    
    /**
     * Get events for an entire month
     */
    getEventsForMonth(machineName, year, month) {
        if (!machineName) return [];
        
        const events = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = this.getEventsForDate(machineName, dateStr);
            events.push(...dayEvents);
        }
        
        return events;
    }
    
    /**
     * Check if a specific hour is unavailable
     */
    isHourUnavailable(machineName, dateStr, hour) {
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(machineName, dateStr);
        return unavailableHours.includes(hour);
    }
    
    /**
     * Toggle hour availability
     */
    toggleHourAvailability(machineName, dateStr, hour) {
        this.storageService.toggleMachineHourAvailability(machineName, dateStr, hour);
    }
    
    /**
     * Set hour as unavailable
     */
    setHourUnavailable(machineName, dateStr, hour) {
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(machineName, dateStr);
        if (!unavailableHours.includes(hour)) {
            unavailableHours.push(hour);
            this.storageService.saveMachineAvailabilityForDate(machineName, dateStr, unavailableHours);
        }
    }
    
    /**
     * Set hour as available
     */
    setHourAvailable(machineName, dateStr, hour) {
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(machineName, dateStr);
        const index = unavailableHours.indexOf(hour);
        if (index > -1) {
            unavailableHours.splice(index, 1);
            this.storageService.saveMachineAvailabilityForDate(machineName, dateStr, unavailableHours);
        }
    }
    
    /**
     * Set a date range as off-time
     */
    setDateRangeOffTime(machineName, startDate, endDate, startHour = 7, endHour = 19) {
        const current = new Date(startDate);
        const events = [];
        
        while (current <= endDate) {
            const dateStr = this.formatDate(current);
            
            // Set hours as unavailable
            for (let hour = startHour; hour < endHour; hour++) {
                this.setHourUnavailable(machineName, dateStr, hour);
            }
            
            // Create event for visualization
            events.push({
                id: `off-time-${machineName}-${dateStr}`,
                title: 'Off-Time',
                type: this.eventTypes.OFF_TIME,
                date: dateStr,
                startHour: startHour,
                endHour: endHour,
                machineName: machineName
            });
            
            current.setDate(current.getDate() + 1);
        }
        
        // Save off-time events for visualization
        this.saveOffTimeEvents(machineName, events);
        
        return events;
    }
    
    /**
     * Get off-time events for a specific date
     */
    getOffTimeEventsForDate(machineName, dateStr) {
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(machineName, dateStr);
        
        if (unavailableHours.length === 0) return [];
        
        // Group consecutive hours into events
        const events = [];
        let currentEvent = null;
        
        unavailableHours.sort((a, b) => a - b);
        
        for (const hour of unavailableHours) {
            if (currentEvent && hour === currentEvent.endHour) {
                // Extend current event
                currentEvent.endHour = hour + 1;
            } else {
                // Start new event
                if (currentEvent) {
                    events.push(currentEvent);
                }
                currentEvent = {
                    id: `off-time-${machineName}-${dateStr}-${hour}`,
                    title: 'Off-Time',
                    type: this.eventTypes.OFF_TIME,
                    date: dateStr,
                    startHour: hour,
                    endHour: hour + 1,
                    machineName: machineName
                };
            }
        }
        
        if (currentEvent) {
            events.push(currentEvent);
        }
        
        return events;
    }
    
    /**
     * Get scheduled events for a specific date (from existing system)
     */
    getScheduledEventsForDate(machineName, dateStr) {
        const scheduledEvents = this.storageService.getEventsByMachine(machineName);
        
        return scheduledEvents
            .filter(event => event.date === dateStr)
            .map(event => ({
                id: event.id || `scheduled-${machineName}-${dateStr}-${event.startHour}`,
                title: event.taskTitle || event.title || 'Scheduled Task',
                type: this.eventTypes.SCHEDULED,
                date: dateStr,
                startHour: event.startHour,
                endHour: event.endHour,
                machineName: machineName,
                originalEvent: event
            }));
    }
    
    /**
     * Save off-time events (for future use if needed)
     */
    saveOffTimeEvents(machineName, events) {
        const storageKey = `offTimeEvents_${machineName}`;
        const existingEvents = window.storageService.getItem(storageKey, []);
        
        // Add new events, avoiding duplicates
        events.forEach(newEvent => {
            const existingIndex = existingEvents.findIndex(e => e.id === newEvent.id);
            if (existingIndex > -1) {
                existingEvents[existingIndex] = newEvent;
            } else {
                existingEvents.push(newEvent);
            }
        });
        
        window.storageService.setItem(storageKey, existingEvents);
    }
    
    /**
     * Remove off-time events for a date range
     */
    removeOffTimeEvents(machineName, startDate, endDate) {
        const current = new Date(startDate);
        
        while (current <= endDate) {
            const dateStr = this.formatDate(current);
            
            // Clear all unavailable hours for this date
            this.storageService.saveMachineAvailabilityForDate(machineName, dateStr, []);
            
            current.setDate(current.getDate() + 1);
        }
        
        // Clean up stored events
        const storageKey = `offTimeEvents_${machineName}`;
        const existingEvents = window.storageService.getItem(storageKey, []);
        const startDateStr = this.formatDate(startDate);
        const endDateStr = this.formatDate(endDate);
        
        const filteredEvents = existingEvents.filter(event => 
            event.date < startDateStr || event.date > endDateStr
        );
        
        window.storageService.setItem(storageKey, filteredEvents);
    }
    
    /**
     * Get all machines with events
     */
    getAllMachinesWithEvents() {
        // This would integrate with the existing machinery system
        // For now, return machines that have availability data
        const machines = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('machineAvailability_')) {
                const machineName = key.replace('machineAvailability_', '');
                if (!machines.includes(machineName)) {
                    machines.push(machineName);
                }
            }
        }
        
        return machines;
    }
    
    /**
     * Utility method to format date
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Get summary statistics for a machine
     */
    getMachineSummary(machineName, startDate, endDate) {
        const summary = {
            totalDays: 0,
            offTimeDays: 0,
            scheduledDays: 0,
            availableDays: 0,
            totalOffTimeHours: 0,
            totalScheduledHours: 0
        };
        
        const current = new Date(startDate);
        
        while (current <= endDate) {
            const dateStr = this.formatDate(current);
            const events = this.getEventsForDate(machineName, dateStr);
            
            summary.totalDays++;
            
            const offTimeHours = events
                .filter(e => e.type === this.eventTypes.OFF_TIME)
                .reduce((total, e) => total + (e.endHour - e.startHour), 0);
                
            const scheduledHours = events
                .filter(e => e.type === this.eventTypes.SCHEDULED)
                .reduce((total, e) => total + (e.endHour - e.startHour), 0);
            
            if (offTimeHours > 0) summary.offTimeDays++;
            if (scheduledHours > 0) summary.scheduledDays++;
            if (offTimeHours === 0 && scheduledHours === 0) summary.availableDays++;
            
            summary.totalOffTimeHours += offTimeHours;
            summary.totalScheduledHours += scheduledHours;
            
            current.setDate(current.getDate() + 1);
        }
        
        return summary;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventStorage;
}