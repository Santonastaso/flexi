/**
 * Production Scheduler - Refactored to use a centralized store
 */
import { BusinessLogicService } from './businessLogicService.js';
import { Utils } from './utils.js';
import { appStore } from './store.js'; // Import the store

export class Scheduler {
    constructor() {
        this.business_logic = new BusinessLogicService();
        this.current_date = new Date();
        this.current_date.setHours(0, 0, 0, 0);

        this.elements = {};
        this.drag_state = {
            is_dragging: false,
            dragged_element: null,
            drag_type: null,
            dragged_data: null
        };
        
        // Debounce availability refresh
        this.availability_refresh_timeout = null;
    }

    init() {
        if (!this._bind_elements()) {
            console.error('Scheduler initialization failed: Required DOM elements not found');
            return false;
        }

        this._attach_event_listeners();
        this.update_date_display();

        appStore.subscribe(() => this.render());
        this.render();

        // Expose debug methods globally for testing
        window.schedulerDebug = {
            setDate: (date) => this.set_current_date(date),
            debugAvailability: () => this.debug_availability(),
            goToAugust13: () => this.set_current_date('2025-08-13'),
            testExactDate: () => this.set_current_date('2025-08-13'),
            showCurrentDate: () => {
                console.log('🔍 Current date object:', this.current_date);
                console.log('🔍 Current date ISO string:', this.current_date.toISOString().split('T')[0]);
                console.log('🔍 Current date local string:', this.current_date.toLocaleDateString());
                console.log('🔍 Current date UTC string:', this.current_date.toUTCString());
                return this.current_date;
            },
            testDateParsing: () => {
                console.log('🔍 === TESTING DATE PARSING ===');
                
                // Test different date formats
                const testDates = [
                    '2025-08-13',
                    '2025-08-13T00:00:00',
                    '2025-08-13T00:00:00Z',
                    'August 13, 2025',
                    '8/13/2025'
                ];
                
                testDates.forEach(dateStr => {
                    const date = new Date(dateStr);
                    console.log(`🔍 "${dateStr}" → ${date.toISOString().split('T')[0]} (${date.toLocaleDateString()})`);
                });
                
                // Test explicit parsing
                const [year, month, day] = '2025-08-13'.split('-').map(Number);
                const explicitDate = new Date(year, month - 1, day);
                console.log(`🔍 Explicit parsing: new Date(${year}, ${month-1}, ${day}) → ${explicitDate.toISOString().split('T')[0]}`);
                
                return 'Date parsing test complete - check console';
            },
            testAvailabilityForDate: (dateStr) => {
                console.log(`🔍 Testing availability for date: ${dateStr}`);
                this.set_current_date(dateStr);
                setTimeout(() => this.debug_availability(), 100);
                return `Testing availability for ${dateStr}`;
            },
            checkTableStatus: async () => {
                console.log('🔍 === CHECKING MACHINE AVAILABILITY TABLE STATUS ===');
                try {
                    const status = await appStore.getMachineAvailabilityStatus();
                    console.log('🔍 Table status:', status);
                    return status;
                } catch (error) {
                    console.error('❌ Error checking table status:', error);
                    return { accessible: false, message: `Error: ${error.message}` };
                }
            },
            debugDateConversion: () => {
                console.log('🔍 === DATE CONVERSION DEBUG ===');
                console.log('🔍 Current date object:', this.current_date);
                console.log('🔍 Current date getDate():', this.current_date.getDate());
                console.log('🔍 Current date getMonth():', this.current_date.getMonth());
                console.log('🔍 Current date getFullYear():', this.current_date.getFullYear());
                console.log('🔍 Formatted date string:', this._get_italian_date_string());
                console.log('🔍 === END DATE CONVERSION DEBUG ===');
                return this._get_italian_date_string();
            }
        };

        return true;
    }

    async render() {
        const { odpOrders, machines, isLoading } = appStore.getState();
        if (isLoading) {
            this.elements.task_pool.innerHTML = '<div class="empty-state">Loading...</div>';
            this.elements.calendar_container.innerHTML = '<div class="empty-state">Loading...</div>';
            return;
        }
        
        const unscheduledTasks = odpOrders.filter(order => order.status !== 'SCHEDULED');
        const scheduledEvents = this._mapOdpToEvents(odpOrders.filter(order => order.status === 'SCHEDULED'));
        const activeMachines = machines.filter(m => m.status === 'ACTIVE');

        // Load machine availability for the current date BEFORE rendering
        // Only load if not already loaded
        const currentDate = this._get_italian_date_string();
        const { machineAvailability } = appStore.getState();
        if (!machineAvailability[currentDate] || machineAvailability[currentDate].length === 0) {
            await this._load_machine_availability_for_date();
        }

        this.load_tasks(unscheduledTasks);
        this.render_calendar(activeMachines, scheduledEvents);
    }
    
    _bind_elements() {
        const elementIds = ['task_pool', 'calendar_container', 'current_date', 'today_btn', 'prev_day', 'next_day', 'message_container'];
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
        return Object.values(this.elements).every(el => el !== null);
    }

    _attach_event_listeners() {
        this.elements.today_btn.addEventListener('click', () => this.go_to_today());
        this.elements.prev_day.addEventListener('click', () => this.previous_day());
        this.elements.next_day.addEventListener('click', () => this.next_day());
        this._setup_task_pool_drop_zone();
    }
    
    _mapOdpToEvents(scheduledOdps) {
        const { machines } = appStore.getState();
        return scheduledOdps.map(odp => {
            const machine = machines.find(m => m.id === odp.scheduled_machine_id);
            return {
                id: `event_${odp.id}`,
                taskId: odp.id,
                taskTitle: odp.odp_number,
                machine: machine ? machine.machine_name : 'Unknown',
                machineId: odp.scheduled_machine_id,
                start_time: odp.scheduled_start_time,
                end_time: odp.scheduled_end_time,
                color: odp.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            };
        });
    }

    /**
     * Set the current date (useful for testing)
     * @param {Date|string} date - Date to set
     */
    set_current_date(date) {
        if (typeof date === 'string') {
            // Handle YYYY-MM-DD format explicitly to avoid timezone issues
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = date.split('-').map(Number);
                this.current_date = new Date(year, month - 1, day); // month is 0-indexed
            } else {
                this.current_date = new Date(date);
            }
        } else {
            this.current_date = new Date(date);
        }
        this.current_date.setHours(0, 0, 0, 0);
        
        console.log('🔍 Setting current date to:', this.current_date);
        console.log('🔍 Date string representation:', this.current_date.toISOString().split('T')[0]);
        
        this.update_date_display();
        this.render();
    }

    go_to_today() {
        this.current_date = new Date();
        this.current_date.setHours(0, 0, 0, 0);
        this.update_date_display();
        this.render();
    }

    previous_day() {
        this.current_date.setDate(this.current_date.getDate() - 1);
        this.update_date_display();
        this.render();
    }

    next_day() {
        this.current_date.setDate(this.current_date.getDate() + 1);
        this.update_date_display();
        this.render();
    }

    update_date_display() {
        if (!this.elements.current_date) return;
        const isToday = this.current_date.toDateString() === new Date().toDateString();
        this.elements.current_date.textContent = isToday ? 'Today' : this.current_date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }

    load_tasks(availableTasks) {
        const taskPool = this.elements.task_pool;
        taskPool.innerHTML = '';
        if (availableTasks.length === 0) {
            taskPool.innerHTML = '<div class="empty-state">No tasks available for scheduling</div>';
            return;
        }
        availableTasks.forEach(task => this._create_task_element(task));
    }

    render_calendar(activeMachines, scheduledEvents) {
        const calendarContainer = this.elements.calendar_container;
        calendarContainer.innerHTML = '';
        if (activeMachines.length === 0) {
            calendarContainer.innerHTML = '<div class="empty-state">No active machines available for scheduling</div>';
            return;
        }
        this._create_calendar_header(calendarContainer);
        activeMachines.forEach(machine => this._create_machine_row(machine, calendarContainer));
        const visibleEvents = scheduledEvents.filter(event => this._is_event_visible(event));
        visibleEvents.forEach(event => this._render_event(event));
    }
    
    async schedule_task(taskId, taskData, slot) {
        const machineId = slot.dataset.machine;
        const hour = parseInt(slot.dataset.hour);
        const minute = parseInt(slot.dataset.minute) || 0;
        const duration = parseFloat(taskData.duration) || 1;

        // Check if the slot is unavailable
        if (slot.dataset.unavailable === 'true') {
            this.show_message('Cannot schedule task: This time slot is marked as unavailable', 'error');
            return;
        }

        // Check if any of the required hours are unavailable
        const machineName = slot.dataset.machineName;
        const requiredHours = [];
        for (let i = 0; i < Math.ceil(duration); i++) {
            const checkHour = (hour + i) % 24;
            requiredHours.push(checkHour);
        }

        const hasUnavailableHours = requiredHours.some(h => this._is_slot_unavailable(machineName, h));
        if (hasUnavailableHours) {
            this.show_message('Cannot schedule task: Some required time slots are marked as unavailable', 'error');
            return;
        }

        const startDate = new Date(this.current_date);
        startDate.setHours(hour, minute, 0, 0);
        const endDate = new Date(startDate.getTime() + (duration * 3600000));

        const event = {
            machine: machineId,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            color: taskData.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        };
        try {
            await appStore.scheduleTask(taskId, event);
            this.show_message('Task scheduled successfully', 'success');
        } catch (error) {
            this.show_message('Failed to schedule task', 'error');
        }
    }

    async unschedule_event(taskId) {
        try {
            await appStore.unscheduleTask(taskId);
            this.show_message('Task unscheduled successfully', 'success');
        } catch (error) {
            this.show_message('Failed to unschedule task', 'error');
        }
    }

    async reschedule_event(taskId, newSlot) {
        const { odpOrders } = appStore.getState();
        const taskData = odpOrders.find(o => o.id === taskId);
        if (taskData) {
            // Check if the new slot is available
            if (newSlot.dataset.unavailable === 'true') {
                this.show_message('Cannot reschedule task: This time slot is marked as unavailable', 'error');
                return;
            }

            // Check if any of the required hours are unavailable
            const machineName = newSlot.dataset.machineName;
            const hour = parseInt(newSlot.dataset.hour);
            const duration = parseFloat(taskData.duration) || 1;
            
            const requiredHours = [];
            for (let i = 0; i < Math.ceil(duration); i++) {
                const checkHour = (hour + i) % 24;
                requiredHours.push(checkHour);
            }

            const hasUnavailableHours = requiredHours.some(h => this._is_slot_unavailable(machineName, h));
            if (hasUnavailableHours) {
                this.show_message('Cannot reschedule task: Some required time slots are marked as unavailable', 'error');
                return;
            }

            await this.schedule_task(taskId, taskData, newSlot);
        }
    }

    _createElement(tag, { className, dataset = {}, textContent = '' } = {}) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        Object.entries(dataset).forEach(([key, value]) => el.dataset[key] = value);
        if (textContent) el.textContent = textContent;
        return el;
    }

    _create_task_element(task) {
        const duration = parseFloat(task.duration) || 1;
        const taskElement = this._createElement('div', {
            className: 'task-item',
            dataset: { taskId: task.id }
        });
        taskElement.draggable = true;
        taskElement.style.background = task.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        taskElement.innerHTML = `<span>${task.odp_number || 'Unknown Task'}</span><span class="task-duration">${duration}h</span>`;
        taskElement.addEventListener('dragstart', (e) => this._on_drag_start(e, taskElement, 'task', task));
        taskElement.addEventListener('dragend', () => this._on_drag_end(taskElement));
        this.elements.task_pool.appendChild(taskElement);
    }

    _create_calendar_header(container) {
        const headerRow = this._createElement('div', { className: 'calendar-header-row' });
        headerRow.appendChild(this._createElement('div', { className: 'machine-label-header', textContent: 'Machines' }));
        const timeHeader = this._createElement('div', { className: 'time-header' });
        for (let slot = 0; slot < 96; slot++) { // Restored 96 slots for 15-min intervals
            const minute = (slot % 4) * 15;
            const textContent = minute === 0 ? `${Math.floor(slot / 4)}`.padStart(2, '0') : '';
            timeHeader.appendChild(this._createElement('div', { className: 'time-slot-header', textContent }));
        }
        headerRow.appendChild(timeHeader);
        container.appendChild(headerRow);
    }

    _create_machine_row(machine, container) {
        const displayName = machine.machine_name || machine.id || 'Unknown Machine';
        const machineRow = this._createElement('div', { className: 'machine-row', dataset: { machine: machine.id, machineName: displayName } });
        const machineLabel = this._createElement('div', { className: 'machine-label' });
        machineLabel.appendChild(this._createElement('div', { className: 'machine-name', textContent: displayName }));
        if (machine.work_center) {
            machineLabel.appendChild(this._createElement('div', { className: 'machine-city', textContent: machine.work_center }));
        }
        machineRow.appendChild(machineLabel);

        const machineSlots = this._createElement('div', { className: 'machine-slots' });
        for (let slotIdx = 0; slotIdx < 96; slotIdx++) { // Restored 96 slots
            const hour = Math.floor(slotIdx / 4);
            const minute = (slotIdx % 4) * 15;
            
            // Check if this slot is unavailable
            const isUnavailable = this._is_slot_unavailable(machine.machine_name, hour);
            
            const slot = this._createElement('div', {
                className: `time-slot ${isUnavailable ? 'unavailable' : ''}`,
                dataset: { 
                    hour, 
                    minute, 
                    slot: slotIdx, 
                    machine: machine.id, 
                    machineName: displayName,
                    unavailable: isUnavailable
                }
            });
            
            // Add visual indicator for unavailable slots
            if (isUnavailable) {
                slot.innerHTML = '<span class="unavailable-indicator">X</span>';
                slot.title = `Machine unavailable from ${hour}:00 to ${hour + 1}:00`;
            }
            
            this._setup_slot_drop_zone(slot);
            machineSlots.appendChild(slot);
        }
        machineRow.appendChild(machineSlots);
        container.appendChild(machineRow);
    }

    _render_event(event) {
        const machineRow = this.elements.calendar_container.querySelector(`[data-machine="${event.machineId}"]`);
        if (!machineRow) return;

        const position = this._calculate_event_position(event);
        if (!position || position.width <= 0) return;

        const eventElement = this._createElement('div', {
            className: 'scheduled-event',
            dataset: { eventId: event.id, taskId: event.taskId },
            textContent: event.taskTitle
        });
        eventElement.style.background = event.color;
        eventElement.style.left = `${position.left}%`;
        eventElement.style.width = `${position.width}%`;
        eventElement.draggable = true;
        eventElement.addEventListener('dragstart', (e) => this._on_drag_start(e, eventElement, 'event'));
        eventElement.addEventListener('dragend', () => this._on_drag_end(eventElement));
        machineRow.querySelector('.machine-slots')?.appendChild(eventElement);
    }

    _on_drag_start(e, element, type, data = null) {
        this.drag_state.is_dragging = true;
        this.drag_state.dragged_element = element;
        this.drag_state.drag_type = type;
        this.drag_state.dragged_data = data;
        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        if (type === 'task') {
            e.dataTransfer.setData('text/plain', data.id);
        } else { // type is 'event'
            e.dataTransfer.setData('text/plain', element.dataset.taskId);
        }
    }

    _on_drag_end(element) {
        this.drag_state = { is_dragging: false, dragged_element: null, drag_type: null, dragged_data: null };
        element.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }

    _setup_task_pool_drop_zone() {
        const taskPool = this.elements.task_pool;
        taskPool.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            taskPool.classList.add('drag-over');
        });
        taskPool.addEventListener('dragleave', (e) => {
            if (!taskPool.contains(e.relatedTarget)) taskPool.classList.remove('drag-over');
        });
        taskPool.addEventListener('drop', (e) => {
            e.preventDefault();
            taskPool.classList.remove('drag-over');
            if (this.drag_state.drag_type === 'event') {
                const taskId = e.dataTransfer.getData('text/plain');
                this.unschedule_event(taskId);
            }
        });
    }

    _setup_slot_drop_zone(slot) {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            slot.classList.add('drag-over');
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            if (this.drag_state.drag_type === 'task') {
                this.schedule_task(taskId, this.drag_state.dragged_data, slot);
            } else if (this.drag_state.drag_type === 'event') {
                this.reschedule_event(taskId, slot);
            }
        });
    }

    _is_event_visible(event) {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        const currentDate = new Date(this.current_date);
        
        return eventStart.toDateString() === currentDate.toDateString() ||
               eventEnd.toDateString() === currentDate.toDateString() ||
               (eventStart <= currentDate && eventEnd >= currentDate);
    }

    /**
     * Get the current date as a YYYY-MM-DD string
     * @returns {string} Date in YYYY-MM-DD format
     */
    _get_italian_date_string() {
        // Simply use the current date as displayed in the UI
        const year = this.current_date.getFullYear();
        const month = String(this.current_date.getMonth() + 1).padStart(2, '0');
        const day = String(this.current_date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    /**
     * Check if a specific time slot is unavailable for a machine
     * @param {string} machineName - Name of the machine
     * @param {number} hour - Hour to check (0-23)
     * @returns {boolean} True if the slot is unavailable
     */
    _is_slot_unavailable(machineName, hour) {
        const { machineAvailability } = appStore.getState();
        
        // Use Italian timezone (Europe/Rome) to avoid timezone issues
        const currentDate = this._get_italian_date_string();
        
        // Find the row for this machine and date
        const availabilityRow = machineAvailability[currentDate]?.find(row => 
            row.machine_name === machineName
        );
        
        if (!availabilityRow || !availabilityRow.unavailable_hours) {
            return false;
        }
        
        // Check if this hour is in the unavailable_hours array
        return availabilityRow.unavailable_hours.includes(hour);
    }

    /**
     * Load machine availability data for the current date
     */
    async _load_machine_availability_for_date() {
        // Use Italian timezone (Europe/Rome) to avoid timezone issues
        const currentDate = this._get_italian_date_string();
        
        // Debug: Show the exact date values
        console.log('🔍 === DATE DEBUG ===');
        console.log('🔍 Current date object:', this.current_date);
        console.log('🔍 Current date getDate():', this.current_date.getDate());
        console.log('🔍 Current date getMonth():', this.current_date.getMonth());
        console.log('🔍 Current date getFullYear():', this.current_date.getFullYear());
        console.log('🔍 Formatted date string:', currentDate);
        console.log('🔍 === END DATE DEBUG ===');
        
        // Check if already loading or already loaded
        const { machineAvailability } = appStore.getState();
        if (machineAvailability[currentDate] && machineAvailability[currentDate]._loading) {
            console.log('⏳ Availability already loading for date:', currentDate);
            return;
        }
        
        if (machineAvailability[currentDate] && machineAvailability[currentDate].length >= 0) {
            console.log('✅ Availability already loaded for date:', currentDate);
            return;
        }
        
        // Debounce rapid successive calls
        if (this._availability_load_timeout) {
            clearTimeout(this._availability_load_timeout);
        }
        
        this._availability_load_timeout = setTimeout(async () => {
            console.log('🔍 Loading availability for date:', currentDate);
            
            try {
                // Load availability for the current date
                await appStore.loadMachineAvailabilityForDate(currentDate);
                console.log('✅ Availability loaded for date:', currentDate);
            } catch (error) {
                console.warn('⚠️ Could not load availability:', error.message);
            }
        }, 100); // 100ms debounce
    }

    /**
     * Refresh the availability display without full re-render
     */
    _refresh_availability_display() {
        // Debounce the refresh to prevent too many updates
        if (this.availability_refresh_timeout) {
            clearTimeout(this.availability_refresh_timeout);
        }
        
        this.availability_refresh_timeout = setTimeout(() => {
            const { machines } = appStore.getState();
            const activeMachines = machines.filter(m => m.status === 'ACTIVE');
            
            activeMachines.forEach(machine => {
                const machineRow = this.elements.calendar_container.querySelector(`[data-machine="${machine.id}"]`);
                if (!machineRow) return;
                
                const slots = machineRow.querySelectorAll('.time-slot');
                slots.forEach((slot, index) => {
                    const hour = Math.floor(index / 4);
                    const isUnavailable = this._is_slot_unavailable(machine.machine_name, hour);
                    
                    // Update slot availability
                    slot.classList.toggle('unavailable', isUnavailable);
                    slot.dataset.unavailable = isUnavailable;
                    
                    // Update visual indicator
                    if (isUnavailable) {
                        slot.innerHTML = '<span class="unavailable-indicator">X</span>';
                        slot.title = `Machine unavailable from ${hour}:00 to ${hour + 1}:00`;
                    } else {
                        slot.innerHTML = '';
                        slot.title = '';
                    }
                });
            });
        }, 100); // 100ms debounce
    }

    /**
     * Refresh machine availability for a specific machine and date
     * Called when availability changes in other views (e.g., machine settings)
     */
    async refresh_machine_availability(machineName, dateStr) {
        try {
            await appStore.loadMachineAvailabilityForMachine(machineName, dateStr, dateStr);
            
            // Re-render the calendar to show updated availability
            const { odpOrders, machines } = appStore.getState();
            const scheduledEvents = this._mapOdpToEvents(odpOrders.filter(order => order.status === 'SCHEDULED'));
            const activeMachines = machines.filter(m => m.status === 'ACTIVE');
            
            this.render_calendar(activeMachines, scheduledEvents);
        } catch (error) {
            console.warn(`⚠️ Could not refresh availability for ${machineName}:`, error.message);
        }
    }

    /**
     * Check if a task can be scheduled in a specific time range
     * @param {string} machineName - Name of the machine
     * @param {Date} startTime - Start time of the task
     * @param {Date} endTime - End time of the task
     * @returns {Object} Validation result with isValid and reason
     */
    can_schedule_task(machineName, startTime, endTime) {
        // Check if the dates are the same (for now, only support same-day scheduling)
        if (startTime.toDateString() !== endTime.toDateString()) {
            return { isValid: false, reason: 'Tasks must be scheduled within the same day' };
        }

        const dateStr = startTime.toISOString().split('T')[0];
        const startHour = startTime.getHours();
        const endHour = endTime.getHours();
        
        // Check each hour in the range
        for (let hour = startHour; hour < endHour; hour++) {
            if (this._is_slot_unavailable(machineName, hour)) {
                return { 
                    isValid: false, 
                    reason: `Machine is unavailable from ${hour}:00 to ${hour + 1}:00` 
                };
            }
        }
        
        return { isValid: true };
    }

    /**
     * Debug method to manually test availability loading
     */
    async debug_availability() {
        console.log('🔍 === DEBUGGING AVAILABILITY ===');
        console.log('🔍 Current date object:', this.current_date);
        console.log('🔍 Current date string (ISO):', this.current_date.toISOString().split('T')[0]);
        
        // Show Italian timezone date
        const italianDateStr = this._get_italian_date_string();
        console.log('🔍 Current date string (Italian timezone):', italianDateStr);
        
        console.log('🔍 Current date local string:', this.current_date.toLocaleDateString());
        console.log('🔍 Current date UTC string:', this.current_date.toUTCString());
        
        const { machines, machineAvailability } = appStore.getState();
        console.log('🔍 All machines:', machines);
        console.log('🔍 Machine availability state:', machineAvailability);
        
        // Try to manually load availability for the current date
        try {
            console.log('🔍 Manually loading availability for date:', italianDateStr);
            await appStore.loadMachineAvailabilityForDate(italianDateStr);
            
            // Check the updated state
            const updatedState = appStore.getState();
            console.log('🔍 Updated machine availability state:', updatedState.machineAvailability);
            
            // Test the availability check method for tufello_mach_1
            console.log('🔍 Testing availability check for tufello_mach_1, hour 1:');
            const isUnavailable = this._is_slot_unavailable('tufello_mach_1', 1);
            console.log('🔍 Hour 1 unavailable:', isUnavailable);
        } catch (error) {
            console.error('❌ Manual load failed:', error);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.availability_refresh_timeout) {
            clearTimeout(this.availability_refresh_timeout);
            this.availability_refresh_timeout = null;
        }
        if (this._availability_load_timeout) {
            clearTimeout(this._availability_load_timeout);
            this._availability_load_timeout = null;
        }
    }

    _calculate_event_position(event) {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return null;

        const dayStart = new Date(this.current_date);
        dayStart.setHours(0, 0, 0, 0);
        
        const totalMinutesInDay = 24 * 60;

        const visibleStart = Math.max(eventStart.getTime(), dayStart.getTime());
        const visibleEnd = Math.min(eventEnd.getTime(), dayStart.getTime() + (totalMinutesInDay * 60 * 1000) - 1);
        
        const startMinute = (new Date(visibleStart).getHours() * 60) + new Date(visibleStart).getMinutes();
        const endMinute = (new Date(visibleEnd).getHours() * 60) + new Date(visibleEnd).getMinutes();

        const left = (startMinute / totalMinutesInDay) * 100;
        let width = ((endMinute - startMinute) / totalMinutesInDay) * 100;

        // Handle case where an event ends at midnight the next day
        if (eventEnd.getTime() > dayStart.getTime() + (totalMinutesInDay * 60 * 1000)) {
            width = ((totalMinutesInDay - startMinute) / totalMinutesInDay) * 100;
        }

        return { left, width };
    }

    show_message(message, type) {
        const messageEl = this.elements.message_container;
        if (!messageEl) return;
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        setTimeout(() => { messageEl.style.display = 'none'; }, 3000);
    }
}