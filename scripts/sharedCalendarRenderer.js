/**
 * Shared Calendar Renderer - Unified calendar rendering for scheduler and machinery settings
 * Provides consistent UI components and styling across the application
 */
class SharedCalendarRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            startHour: options.startHour || 7,
            endHour: options.endHour || 19,
            showMachines: options.showMachines !== undefined ? options.showMachines : true,
            interactive: options.interactive !== undefined ? options.interactive : true,
            slotHeight: options.slotHeight || 48,
            labelWidth: options.labelWidth || 150,
            ...options
        };
        
        this.currentDate = options.currentDate || new Date();
        this.machines = options.machines || [];
        
        this.eventHandlers = {
            onSlotClick: options.onSlotClick || null,
            onSlotDrop: options.onSlotDrop || null,
            onSlotHover: options.onSlotHover || null
        };
    }
    
    /**
     * Render the complete calendar grid
     */
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        this.container.className = 'shared-calendar-container';
        
        if (this.options.showMachines) {
            this.renderMachineGrid();
        } else {
            this.renderSimpleGrid();
        }
    }
    
    /**
     * Render calendar grid with machine rows (for scheduler)
     */
    renderMachineGrid() {
        const html = `
            <div class="calendar-grid">
                <div class="calendar-header">
                    ${this.renderHeader()}
                </div>
                <div class="calendar-body">
                    ${this.renderMachineRows()}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.attachEventListeners();
    }
    
    /**
     * Render simple time grid (for machinery settings week view)
     */
    renderSimpleGrid() {
        const html = `
            <div class="calendar-grid simple">
                <div class="calendar-header">
                    ${this.renderSimpleHeader()}
                </div>
                <div class="calendar-body">
                    ${this.renderTimeRows()}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.attachEventListeners();
    }
    
    /**
     * Render header with time slots
     */
    renderHeader() {
        let html = `<div class="header-label-spacer">Machines</div>`;
        
        for (let hour = this.options.startHour; hour < this.options.endHour; hour++) {
            html += `
                <div class="time-header-slot" data-hour="${hour}">
                    ${this.formatHour(hour)}
                </div>
            `;
        }
        
        return html;
    }
    
    /**
     * Render simple header for single-day view
     */
    renderSimpleHeader() {
        let html = `<div class="header-label-spacer"></div>`;
        
        for (let hour = this.options.startHour; hour < this.options.endHour; hour++) {
            html += `
                <div class="time-header-slot" data-hour="${hour}">
                    ${this.formatHour(hour)}
                </div>
            `;
        }
        
        return html;
    }
    
    /**
     * Render machine rows with time slots
     */
    renderMachineRows() {
        return this.machines.map(machine => `
            <div class="machine-row" data-machine="${machine.name}">
                <div class="machine-label">
                    <span class="machine-name">${machine.name}</span>
                    <small class="machine-city">${machine.city}</small>
                </div>
                <div class="machine-slots">
                    ${this.renderTimeSlots(machine.name)}
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Render time rows for simple grid
     */
    renderTimeRows() {
        let html = '';
        
        for (let hour = this.options.startHour; hour < this.options.endHour; hour++) {
            html += `
                <div class="time-row" data-hour="${hour}">
                    <div class="time-label">${this.formatHour(hour)}</div>
                    <div class="time-slot ${this.getSlotClasses('', hour)}" 
                         data-hour="${hour}" 
                         data-date="${this.formatDate(this.currentDate)}">
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    /**
     * Render time slots for a machine
     */
    renderTimeSlots(machineName) {
        let html = '';
        
        for (let hour = this.options.startHour; hour < this.options.endHour; hour++) {
            const classes = this.getSlotClasses(machineName, hour);
            const slotId = `slot-${machineName}-${hour}`;
            
            html += `
                <div class="time-slot ${classes}" 
                     id="${slotId}"
                     data-machine="${machineName}" 
                     data-hour="${hour}" 
                     data-date="${this.formatDate(this.currentDate)}"
                     ${this.options.interactive ? 'data-droppable="true"' : ''}>
                </div>
            `;
        }
        
        return html;
    }
    
    /**
     * Get CSS classes for a time slot based on its state
     */
    getSlotClasses(machineName, hour) {
        const classes = ['slot'];
        const dateStr = this.formatDate(this.currentDate);
        
        // Add state-based classes
        if (this.isSlotOccupied(machineName, hour)) {
            classes.push('occupied');
        }
        
        if (this.isSlotUnavailable(machineName, hour)) {
            classes.push('unavailable');
        }
        
        if (this.options.interactive) {
            classes.push('interactive');
        }
        
        return classes.join(' ');
    }
    
    /**
     * Check if slot is occupied by scheduled events
     */
    isSlotOccupied(machineName, hour) {
        if (!window.storageService || !machineName) return false;
        
        const dateStr = this.formatDate(this.currentDate);
        const events = window.storageService.getEventsByDate(dateStr);
        
        return events.some(event => 
            event.machine === machineName &&
            hour >= event.startHour && 
            hour < event.endHour
        );
    }
    
    /**
     * Check if slot is unavailable due to machine settings
     */
    isSlotUnavailable(machineName, hour) {
        if (!window.storageService || !machineName) return false;
        
        const dateStr = this.formatDate(this.currentDate);
        const unavailableHours = window.storageService.getMachineAvailabilityForDate(machineName, dateStr);
        
        return unavailableHours.includes(hour);
    }
    
    /**
     * Attach event listeners to calendar elements
     */
    attachEventListeners() {
        if (!this.options.interactive) return;
        
        const slots = this.container.querySelectorAll('.time-slot.interactive');
        
        slots.forEach(slot => {
            // Click events
            if (this.eventHandlers.onSlotClick) {
                slot.addEventListener('click', (e) => {
                    const machine = slot.dataset.machine;
                    const hour = parseInt(slot.dataset.hour);
                    const date = slot.dataset.date;
                    
                    this.eventHandlers.onSlotClick(e, { machine, hour, date, slot });
                });
            }
            
            // Hover events
            if (this.eventHandlers.onSlotHover) {
                slot.addEventListener('mouseenter', (e) => {
                    const machine = slot.dataset.machine;
                    const hour = parseInt(slot.dataset.hour);
                    const date = slot.dataset.date;
                    
                    this.eventHandlers.onSlotHover(e, { machine, hour, date, slot }, 'enter');
                });
                
                slot.addEventListener('mouseleave', (e) => {
                    const machine = slot.dataset.machine;
                    const hour = parseInt(slot.dataset.hour);
                    const date = slot.dataset.date;
                    
                    this.eventHandlers.onSlotHover(e, { machine, hour, date, slot }, 'leave');
                });
            }
            
            // Drag and drop events
            if (this.eventHandlers.onSlotDrop) {
                slot.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    slot.classList.add('drag-over');
                });
                
                slot.addEventListener('dragleave', (e) => {
                    slot.classList.remove('drag-over');
                });
                
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    slot.classList.remove('drag-over');
                    
                    const machine = slot.dataset.machine;
                    const hour = parseInt(slot.dataset.hour);
                    const date = slot.dataset.date;
                    const taskId = e.dataTransfer.getData('text/plain');
                    
                    this.eventHandlers.onSlotDrop(e, { machine, hour, date, slot, taskId });
                });
            }
        });
    }
    
    /**
     * Render scheduled events on the calendar
     */
    renderEvents(events) {
        // Clear existing events
        this.container.querySelectorAll('.event-block').forEach(el => el.remove());
        
        events.forEach(event => {
            this.renderEvent(event);
        });
    }
    
    /**
     * Render a single event block
     */
    renderEvent(event) {
        const startSlot = this.container.querySelector(`[data-machine="${event.machine}"][data-hour="${event.startHour}"]`);
        if (!startSlot) return;
        
        const eventElement = document.createElement('div');
        eventElement.className = 'event-block';
        eventElement.style.backgroundColor = event.color || '#2563eb';
        eventElement.style.color = 'white';
        eventElement.style.width = `${(event.endHour - event.startHour) * 100}%`;
        eventElement.style.position = 'absolute';
        eventElement.style.top = '2px';
        eventElement.style.left = '2px';
        eventElement.style.bottom = '2px';
        eventElement.style.borderRadius = '4px';
        eventElement.style.padding = '4px 8px';
        eventElement.style.fontSize = '12px';
        eventElement.style.fontWeight = '700';
        eventElement.style.display = 'flex';
        eventElement.style.alignItems = 'center';
        eventElement.style.justifyContent = 'space-between';
        eventElement.style.overflow = 'hidden';
        eventElement.style.textOverflow = 'ellipsis';
        eventElement.style.whiteSpace = 'nowrap';
        eventElement.style.cursor = 'move';
        eventElement.style.zIndex = '10';
        
        // Create title element
        const titleElement = document.createElement('span');
        titleElement.textContent = event.taskTitle || event.name || 'Scheduled Task';
        titleElement.style.flex = '1';
        titleElement.style.overflow = 'hidden';
        titleElement.style.textOverflow = 'ellipsis';
        titleElement.style.whiteSpace = 'nowrap';
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'event-delete-btn';
        deleteButton.innerHTML = '×';
        deleteButton.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            padding: 0;
            margin-left: 8px;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            opacity: 0.7;
            transition: opacity 0.2s ease;
        `;
        
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.handleEventDelete(event);
        });
        
        deleteButton.addEventListener('mouseenter', () => {
            deleteButton.style.opacity = '1';
            deleteButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        deleteButton.addEventListener('mouseleave', () => {
            deleteButton.style.opacity = '0.7';
            deleteButton.style.backgroundColor = 'transparent';
        });
        
        // Assemble event element
        eventElement.appendChild(titleElement);
        eventElement.appendChild(deleteButton);
        eventElement.draggable = true;
        eventElement.dataset.eventId = event.id;
        
        // Add drag event
        eventElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', event.id);
            e.dataTransfer.setData('application/json', JSON.stringify(event));
        });
        
        // Position relative to parent slot
        startSlot.style.position = 'relative';
        startSlot.appendChild(eventElement);
    }
    
    /**
     * Handle event deletion with confirmation
     */
    handleEventDelete(event) {
        if (typeof showConfirmBanner === 'function') {
            showConfirmBanner(`Delete "${event.taskTitle || event.name}" from the schedule?`, () => {
                // Remove from storage
                if (window.storageService) {
                    window.storageService.removeScheduledEvent(event.id);
                }
                
                // Remove from DOM
                const eventElement = this.container.querySelector(`[data-event-id="${event.id}"]`);
                if (eventElement) {
                    eventElement.remove();
                }
                
                // Show success message
                if (typeof showBanner === 'function') {
                    showBanner('Task removed from schedule', 'success');
                }
                
                // Trigger refresh if callback exists
                if (this.options.onEventDelete) {
                    this.options.onEventDelete(event);
                }
            });
        } else {
            // Fallback if banner system not available
            showDeleteConfirmation(`Delete "${event.taskTitle || event.name}" from the schedule?`, () => {
                if (window.storageService) {
                    window.storageService.removeScheduledEvent(event.id);
                }
                
                const eventElement = this.container.querySelector(`[data-event-id="${event.id}"]`);
                if (eventElement) {
                    eventElement.remove();
                }
            });
        }
    }
    
    /**
     * Update calendar date and re-render
     */
    updateDate(newDate) {
        this.currentDate = newDate;
        this.render();
    }
    
    /**
     * Update machines list and re-render
     */
    updateMachines(machines) {
        this.machines = machines;
        this.render();
    }
    
    /**
     * Refresh calendar with current data
     */
    refresh() {
        this.render();
    }
    
    /**
     * Utility methods
     */
    formatHour(hour) {
        return Utils.formatHour(hour);
    }
    
    formatDate(date) {
        return Utils.formatDate(date);
    }
    
    /**
     * Get slot element by machine and hour
     */
    getSlot(machine, hour) {
        return this.container.querySelector(`[data-machine="${machine}"][data-hour="${hour}"]`);
    }
    
    /**
     * Highlight slot (for feedback)
     */
    highlightSlot(machine, hour, className = 'highlighted') {
        const slot = this.getSlot(machine, hour);
        if (slot) {
            slot.classList.add(className);
        }
    }
    
    /**
     * Remove highlight from slot
     */
    unhighlightSlot(machine, hour, className = 'highlighted') {
        const slot = this.getSlot(machine, hour);
        if (slot) {
            slot.classList.remove(className);
        }
    }
    
    /**
     * Clear all highlights
     */
    clearHighlights(className = 'highlighted') {
        this.container.querySelectorAll(`.${className}`).forEach(slot => {
            slot.classList.remove(className);
        });
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedCalendarRenderer;
}