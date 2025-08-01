/**
 * Machine Availability Manager - Handles machine availability calendar
 */
class MachineAvailabilityManager {
    constructor() {
        this.storageService = window.storageService;
        this.elements = {};
        this.machineName = null;
        this.currentDate = new Date("2025-08-01T00:00:00");
        this.init();
    }
    
    /**
     * Initialize the availability manager
     */
    init() {
        this.getMachineFromURL();
        this.bindElements();
        this.attachEventListeners();
        this.initializeCalendar();
    }
    
    /**
     * Get machine name from URL parameters
     */
    getMachineFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        this.machineName = urlParams.get('machine');
        
        if (!this.machineName) {
            console.error('No machine specified in URL');
            return false;
        }
        
        return true;
    }
    
    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            machineTitle: document.getElementById('machine-title'),
            monthSelect: document.getElementById('month-select'),
            calendarEl: document.getElementById('availability-calendar')
        };
        
        // Validate required elements
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);
            
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            return false;
        }
        
        return true;
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.elements.monthSelect || !this.elements.calendarEl) return;
        
        // Month selection change
        this.elements.monthSelect.addEventListener('change', () => {
            const [year, month] = this.elements.monthSelect.value.split('-').map(Number);
            this.renderCalendar(year, month - 1);
        });
        
        // Calendar cell clicks
        this.elements.calendarEl.addEventListener('click', (e) => {
            this.handleSlotClick(e);
        });
    }
    
    /**
     * Initialize the calendar
     */
    initializeCalendar() {
        if (!this.machineName) {
            if (this.elements.machineTitle) {
                this.elements.machineTitle.textContent = "Machine Not Found";
            }
            return;
        }
        
        // Set title
        if (this.elements.machineTitle) {
            this.elements.machineTitle.textContent = `Availability for: ${this.machineName}`;
        }
        
        // Set initial month
        if (this.elements.monthSelect) {
            this.elements.monthSelect.value = this.currentDate.toISOString().slice(0, 7);
        }
        
        // Render initial calendar
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.renderCalendar(year, month);
    }
    
    /**
     * Render the availability calendar
     */
    renderCalendar(year, month) {
        if (!this.elements.calendarEl) return;
        
        this.elements.calendarEl.innerHTML = '';
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startHour = 8;
        const endHour = 20;
        
        // Create header
        let headerHtml = '<thead><tr><th>Day</th>';
        for (let h = startHour; h < endHour; h++) {
            headerHtml += `<th>${h}:00</th>`;
        }
        headerHtml += '</tr></thead>';
        this.elements.calendarEl.innerHTML += headerHtml;
        
        // Create body
        let bodyHtml = '<tbody>';
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            bodyHtml += `<tr><td class="day-label">${day}</td>`;
            
            const unavailableHours = this.storageService.getMachineAvailabilityForDate(this.machineName, dateKey);
            const scheduledEvents = this.storageService.getEventsByMachine(this.machineName);
            
            for (let h = startHour; h < endHour; h++) {
                const isUnavailable = unavailableHours.includes(h);
                const isScheduled = scheduledEvents.some(event => 
                    event.date === dateKey && 
                    h >= event.startHour && 
                    h < event.endHour
                );
                
                let slotClass = 'hour-slot';
                let slotContent = '✓';
                
                if (isScheduled) {
                    slotClass += ' scheduled';
                    slotContent = 'BUSY';
                } else if (isUnavailable) {
                    slotClass += ' unavailable';
                    slotContent = 'X';
                }
                
                bodyHtml += `<td class="${slotClass}" data-date="${dateKey}" data-hour="${h}">${slotContent}</td>`;
            }
            bodyHtml += '</tr>';
        }
        bodyHtml += '</tbody>';
        this.elements.calendarEl.innerHTML += bodyHtml;
    }
    
    /**
     * Handle clicking on a time slot
     */
    handleSlotClick(e) {
        const slot = e.target;
        if (!slot.classList.contains('hour-slot')) return;
        
        const date = slot.dataset.date;
        const hour = parseInt(slot.dataset.hour);
        
        if (slot.classList.contains('scheduled')) {
            alert('This slot is occupied by a scheduled task. You cannot mark it as unavailable.');
            return;
        }
        
        try {
            // Toggle hour availability
            this.storageService.toggleMachineHourAvailability(this.machineName, date, hour);
            
            // Re-render calendar
            const [year, month] = this.elements.monthSelect.value.split('-').map(Number);
            this.renderCalendar(year, month - 1);
            
        } catch (error) {
            console.error('Error toggling availability:', error);
            alert('Error updating availability. Please try again.');
        }
    }
    
    /**
     * Public method to refresh the calendar
     */
    refresh() {
        if (this.elements.monthSelect) {
            const [year, month] = this.elements.monthSelect.value.split('-').map(Number);
            this.renderCalendar(year, month - 1);
        }
    }
    
    /**
     * Public method to navigate to a specific month
     */
    navigateToMonth(year, month) {
        if (this.elements.monthSelect) {
            this.elements.monthSelect.value = `${year}-${String(month + 1).padStart(2, '0')}`;
            this.renderCalendar(year, month);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the machine availability page
    if (document.getElementById('availability-calendar')) {
        window.machineAvailabilityManager = new MachineAvailabilityManager();
    }
});