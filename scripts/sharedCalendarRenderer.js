/**
 * Shared Calendar Renderer - Unified calendar rendering for scheduler and machinery settings
 * Provides consistent UI components and styling across the application
 */
class SharedCalendarRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
                    start_hour: options.startHour || 0,
        end_hour: options.endHour || 24,
            show_machines: options.showMachines !== undefined ? options.showMachines : true,
            interactive: options.interactive !== undefined ? options.interactive : true,
            slot_height: options.slotHeight || 48,
            label_width: options.labelWidth || 150,
            ...options
        };
        this.current_date = options.currentDate || new Date();
        this.machines = options.machines || [];
        this.event_handlers = {
            on_slot_click: options.onSlotClick || null,
            on_slot_drop: options.onSlotDrop || null,
            on_slot_hover: options.onSlotHover || null
        };
    }
    /**
     * Render the complete calendar grid
     */
    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.container.className = 'shared-calendar-container';
        if (this.options.show_machines) {
            this.render_machine_grid();
        } else {
            this.render_simple_grid();
        }
    }
    /**
     * Render calendar grid with machine rows (for scheduler)
     */
    render_machine_grid() {
        const html = `
            <div class="calendar-grid">
                <div class="calendar-header">
                    ${this.render_header()}
                </div>
                <div class="calendar-body">
                    ${this.render_machine_rows()}
                </div>
            </div>
        `;
        this.container.innerHTML = html;
        this.attach_event_listeners();
    }
    /**
     * Render simple time grid (for machinery settings week view)
     */
    render_simple_grid() {
        const html = `
            <div class="calendar-grid simple">
                <div class="calendar-header">
                    ${this.render_simple_header()}
                </div>
                <div class="calendar-body">
                    ${this.render_time_rows()}
                </div>
            </div>
        `;
        this.container.innerHTML = html;
        this.attach_event_listeners();
    }
    /**
     * Render header with time slots
     */
    render_header() {
        let html = `<div class="header-label-spacer">Machines</div>`;
        for (let hour = this.options.start_hour; hour < this.options.end_hour; hour++) {
            html += `
                <div class="time-header-slot" data-hour="${hour}">
                    ${this.format_hour(hour)}
                </div>
            `;
        }
        return html;
    }
    /**
     * Render simple header for single-day view
     */
    render_simple_header() {
        let html = `<div class="header-label-spacer"></div>`;
        for (let hour = this.options.start_hour; hour < this.options.end_hour; hour++) {
            html += `
                <div class="time-header-slot" data-hour="${hour}">
                    ${this.format_hour(hour)}
                </div>
            `;
        }
        return html;
    }
    /**
     * Render machine rows with time slots
     */
    render_machine_rows() {
        return this.machines.map(machine => `
            <div class="machine-row" data-machine="${machine.machine_name}">
                <div class="machine-label">
                    <span class="machine-name">${machine.machine_name}</span>
                    <small class="machine-city">${machine.city}</small>
                </div>
                <div class="machine-slots">
                    ${this.render_time_slots(machine.machine_name)}
                </div>
            </div>
        `).join('');
    }
    /**
     * Render time rows for simple grid
     */
    render_time_rows() {
        let html = '';
        for (let hour = this.options.start_hour; hour < this.options.end_hour; hour++) {
            html += `
                <div class="time-row" data-hour="${hour}">
                    <div class="time-label">${this.format_hour(hour)}</div>
                    <div class="time-slot ${this.get_slot_classes('', hour)}" 
                         data-hour="${hour}" 
                         data-date="${this.format_date(this.current_date)}">
                    </div>
                </div>
            `;
        }
        return html;
    }
    /**
     * Render time slots for a machine
     */
    render_time_slots(machine_name) {
        let html = '';
        for (let hour = this.options.start_hour; hour < this.options.end_hour; hour++) {
            const classes = this.get_slot_classes(machine_name, hour);
            const slot_id = `slot-${machine_name}-${hour}`;
            html += `
                <div class="time-slot ${classes}" 
                     id="${slot_id}"
                     data-machine="${machine_name}" 
                     data-hour="${hour}" 
                     data-date="${this.format_date(this.current_date)}"
                     ${this.options.interactive ? 'data-droppable="true"' : ''}>
                </div>
            `;
        }
        return html;
    }
    /**
     * Get CSS classes for a time slot based on its state
     */
    get_slot_classes(machine_name, hour) {
        const classes = ['slot'];
        const date_str = this.format_date(this.current_date);
        // Add state-based classes
        if (this.is_slot_occupied(machine_name, hour)) {
            classes.push('occupied');
        }
        if (this.is_slot_unavailable(machine_name, hour)) {
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
    is_slot_occupied(machine_name, hour) {
        if (!window.storageService || !machine_name) return false;
        const date_str = this.format_date(this.current_date);
        const events = window.storageService.getEventsByDate(date_str);
        return events.some(event => 
            event.machine === machine_name &&
            hour >= event.startHour && 
            hour < event.endHour
        );
    }
    /**
     * Check if slot is unavailable due to machine settings
     */
    is_slot_unavailable(machine_name, hour) {
        if (!window.storageService || !machine_name) return false;
        const date_str = this.format_date(this.current_date);
        const unavailable_hours = window.storageService.getMachineAvailabilityForDate(machine_name, date_str);
        return unavailable_hours.includes(hour);
    }
    /**
     * Attach event listeners to calendar elements
     */
    attach_event_listeners() {
        if (!this.options.interactive) return;
        const slots = this.container.querySelectorAll('.time-slot.interactive');
        slots.forEach(slot => {
            // Click events
            if (this.event_handlers.on_slot_click) {
                slot.addEventListener('click', (e) => {
                    const machine = slot.dataset.machine;
                    const hour = parseInt(slot.dataset.hour);
                    const date = slot.dataset.date;
                    this.event_handlers.on_slot_click(e, { machine, hour, date, slot });
                });
            }
            // Hover events
            if (this.event_handlers.on_slot_hover) {
                slot.addEventListener('mouseenter', (e) => {
                    const machine = slot.dataset.machine;
                    const hour = parseInt(slot.dataset.hour);
                    const date = slot.dataset.date;
                    this.event_handlers.on_slot_hover(e, { machine, hour, date, slot }, 'enter');
                });
                slot.addEventListener('mouseleave', (e) => {
                    const machine = slot.dataset.machine;
                    const hour = parseInt(slot.dataset.hour);
                    const date = slot.dataset.date;
                    this.event_handlers.on_slot_hover(e, { machine, hour, date, slot }, 'leave');
                });
            }
            // Drag and drop events
            if (this.event_handlers.on_slot_drop) {
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
                    const task_id = e.dataTransfer.getData('text/plain');
                    this.event_handlers.on_slot_drop(e, { machine, hour, date, slot, task_id });
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
            this.render_event(event);
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
            show_delete_confirmation(`Delete "${event.taskTitle || event.name}" from the schedule?`, () => {
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
    update_machines(machines) {
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
    format_hour(hour) {
        return Utils.format_hour(hour);
    }
    format_date(date) {
        return Utils.format_date(date);
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