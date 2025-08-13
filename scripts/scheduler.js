/**
 * Production Scheduler - Fixed Implementation
 * Uses existing CSS structure and StorageService API
 */
class Scheduler {
    constructor() {
        this.storageService = window.storageService;
        this.businessLogic = new BusinessLogicService();
        this.currentDate = new Date();
        this.currentDate.setHours(0, 0, 0, 0);
        
        this.elements = {};
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            dragType: null // 'task' or 'event'
        };
        
        this.init();
    }
    
    init() {
        this.bind_elements();
        this.attach_event_listeners();
        this.load_tasks();
        this.render_calendar();
        this.update_date_display();
    }
    
    bind_elements() {
        this.elements = {
            task_pool: document.getElementById('task_pool'),
            calendar_container: document.getElementById('calendar_container'),
            current_date: document.getElementById('current_date'),
            today_btn: document.getElementById('today_btn'),
            prev_day: document.getElementById('prev_day'),
            next_day: document.getElementById('next_day'),
            message_container: document.getElementById('message_container')
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
    
    attach_event_listeners() {
        this.elements.today_btn.addEventListener('click', () => this.go_to_today());
        this.elements.prev_day.addEventListener('click', () => this.previous_day());
        this.elements.next_day.addEventListener('click', () => this.next_day());
        
        // Setup task pool drop zone
        this.setup_task_pool_drop_zone();
        
        // Listen for machine availability changes
        window.addEventListener('machineAvailabilityChanged', () => {
            this.refresh_calendar();
        });
    }
    
    setup_task_pool_drop_zone() {
        const taskPool = this.elements.task_pool;
        
        taskPool.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            taskPool.classList.add('drag-over');
        });
        
        taskPool.addEventListener('dragleave', (e) => {
            if (!taskPool.contains(e.relatedTarget)) {
                taskPool.classList.remove('drag-over');
            }
        });
        
        taskPool.addEventListener('drop', (e) => {
            e.preventDefault();
            taskPool.classList.remove('drag-over');
            
            const eventId = e.dataTransfer.getData('text/plain');
            if (eventId && this.dragState.dragType === 'event') {
                this.unschedule_event(eventId);
            }
        });
    }
    
    load_tasks() {
        const taskPool = this.elements.task_pool;
        
        // Clear the task pool completely
        taskPool.innerHTML = '';
        
        // Get available tasks (ODP orders that aren't scheduled)
        const allOrders = this.storageService.get_odp_orders();
        const scheduledEvents = this.storageService.get_scheduled_events();
        const scheduledTaskIds = new Set(scheduledEvents.map(event => event.taskId));
        
        const availableTasks = allOrders.filter(order => !scheduledTaskIds.has(order.id));
        
        if (availableTasks.length === 0) {
            taskPool.innerHTML = '<div class="empty-state">No tasks available for scheduling</div>';
            return;
        }
        
        availableTasks.forEach(task => {
            this.create_task_element(task);
        });
    }
    
    create_task_element(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.draggable = true;
        taskElement.dataset.taskId = task.id;
        taskElement.style.background = this.get_task_color(task);
        
        const duration = this.get_task_duration(task);
        
        taskElement.innerHTML = `
            <span>${task.odp_number || task.name || 'Unknown Task'}</span>
            <span class="task-duration">${duration}h</span>
        `;
        
        // Drag events
        taskElement.addEventListener('dragstart', (e) => {
            this.dragState.isDragging = true;
            this.dragState.draggedElement = taskElement;
            this.dragState.dragType = 'task';
            
            taskElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
            e.dataTransfer.setData('application/json', JSON.stringify(task));
            e.dataTransfer.effectAllowed = 'move';
        });
        
        taskElement.addEventListener('dragend', (e) => {
            this.dragState.isDragging = false;
            this.dragState.draggedElement = null;
            this.dragState.dragType = null;
            taskElement.classList.remove('dragging');
            
            // Clear drag-over states
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
        
        this.elements.task_pool.appendChild(taskElement);
    }
    
    render_calendar() {
        // Get only active machines for scheduling
        const allMachines = this.storageService.get_machines();
        
        const activeMachines = this.get_active_machines(allMachines);
        
        const calendarContainer = this.elements.calendar_container;
        calendarContainer.innerHTML = '';
        
        if (activeMachines.length === 0) {
            calendarContainer.innerHTML = '<div class="empty-state">No active machines available for scheduling</div>';
            return;
        }
        
        // Create header
        this.create_calendar_header(calendarContainer);
        
        // Create machine rows
        activeMachines.forEach(machine => {
            this.create_machine_row(machine, calendarContainer);
        });
        
        // Render scheduled events
        this.render_scheduled_events();
    }
    
    /**
     * Refresh calendar to reflect machine availability changes
     */
    refresh_calendar() {
        this.render_calendar();
    }

    /**
     * Get machines that are available for production scheduling
     * @param {Array} machines - All machines
     * @returns {Array} - Active machines only
     */
    get_active_machines(machines) {
        return machines.filter(machine => {
            // Check status field (case-insensitive)
            if (machine.status) {
                return machine.status.toUpperCase() === 'ACTIVE';
            }
            
            // Fallback: machines with names are considered active
            return machine.machine_name;
        });
    }
    
    /**
     * Get machine display name for UI
     * @param {Object} machine - Machine object
     * @returns {string} - Display name
     */
    get_machine_display_name(machine) {
        // Use machine_name if available, otherwise fall back to id
        return machine.machine_name || machine.name || machine.id || 'Unknown Machine';
    }
    
    create_calendar_header(container) {
        const headerRow = document.createElement('div');
        headerRow.className = 'calendar-header-row';
        
        // Machine label header
        const machineHeader = document.createElement('div');
        machineHeader.className = 'machine-label-header';
        machineHeader.textContent = 'Machines';
        headerRow.appendChild(machineHeader);
        
        // Time headers
        const timeHeader = document.createElement('div');
        timeHeader.className = 'time-header';
        
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot-header';
            timeSlot.textContent = `${hour.toString().padStart(2, '0')}:00`;
            timeHeader.appendChild(timeSlot);
        }
        
        headerRow.appendChild(timeHeader);
        container.appendChild(headerRow);
    }
    
    create_machine_row(machine, container) {
        const machineRow = document.createElement('div');
        machineRow.className = 'machine-row';
        
        // Use unified model field consistently
        const displayName = this.get_machine_display_name(machine);
        machineRow.dataset.machine = displayName;
        
        // Machine label
        const machineLabel = document.createElement('div');
        machineLabel.className = 'machine-label';
        
        const machineName = document.createElement('div');
        machineName.className = 'machine-name';
        machineName.textContent = displayName;
        machineLabel.appendChild(machineName);
        
        if (machine.work_center) {
            const machineCity = document.createElement('div');
            machineCity.className = 'machine-city';
            machineCity.textContent = machine.work_center;
            machineLabel.appendChild(machineCity);
        }
        
        // Add machine status indicator
        if (machine.status && machine.status !== 'ACTIVE') {
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'machine-status';
            statusIndicator.textContent = machine.status;
            statusIndicator.style.fontSize = '11px';
            statusIndicator.style.color = '#666';
            machineLabel.appendChild(statusIndicator);
        }
        
        machineRow.appendChild(machineLabel);
        
        // Machine slots
        const machineSlots = document.createElement('div');
        machineSlots.className = 'machine-slots';
        
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.dataset.hour = hour;
            timeSlot.dataset.machine = this.get_machine_display_name(machine);
            
            // Check if this hour is unavailable for the machine
            const dateStr = this.format_date(this.currentDate);
            const machineName = this.get_machine_display_name(machine);
            const unavailableHours = this.storageService.get_machine_availability_for_date(machineName, dateStr);
            if (unavailableHours.includes(hour)) {
                timeSlot.classList.add('unavailable');
                timeSlot.style.pointerEvents = 'none'; // Disable drop zone for unavailable slots
            }
            
            // Setup drop zone
            this.setup_slot_drop_zone(timeSlot);
            
            machineSlots.appendChild(timeSlot);
        }
        
        machineRow.appendChild(machineSlots);
        container.appendChild(machineRow);
    }
    
    setup_slot_drop_zone(slot) {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            slot.classList.add('drag-over');
            
            // Add visual feedback for valid drop zones
            if (this.dragState.isDragging) {
                slot.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
            }
        });
        
        slot.addEventListener('dragleave', (e) => {
            slot.classList.remove('drag-over');
            slot.style.backgroundColor = ''; // Reset background color
        });
        
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            slot.style.backgroundColor = ''; // Reset background color
            
            const taskId = e.dataTransfer.getData('text/plain');
            
            // Only try to parse JSON if we're dragging a task (not an event)
            if (taskId && this.dragState.dragType === 'task') {
                try {
                    const taskDataJson = e.dataTransfer.getData('application/json');
                    if (taskDataJson) {
                        const taskData = JSON.parse(taskDataJson);
                        this.schedule_task(taskId, taskData, slot);
                    } else {
                        // No task data found for task ID
                    }
                } catch (error) {
                    console.error('Error parsing task data:', error);
                    this.show_message('Error scheduling task: Invalid data', 'error');
                }
            } else if (taskId && this.dragState.dragType === 'event') {
                // Handle moving existing events (rescheduling)
                this.reschedule_event(taskId, slot);
            }
        });
    }
    
    schedule_task(taskId, taskData, slot) {
        const machine = slot.dataset.machine;
        const hour = parseInt(slot.dataset.hour);
        const duration = this.get_task_duration(taskData);
        
        // Create event
        const event = {
            id: `${taskId}-${Date.now()}`,
            taskId: taskId,
            taskTitle: taskData.odp_number || taskData.name || 'Unknown Task',
            machine: machine,
            date: this.format_date(this.currentDate),
            startHour: hour,
            endHour: hour + duration,
            color: this.get_task_color(taskData),
            duration: duration
        };
        
        // Validate scheduling
        if (!this.can_schedule_task(machine, hour, duration)) {
            this.show_message('Cannot schedule task at this time', 'error');
            return;
        }
        
        try {
            if (window.DEBUG) {
                console.log('Scheduling task with event data:', event);
            }
            
            this.storageService.add_scheduled_event(event);
            
            // Dispatch custom event for status update
            window.dispatchEvent(new CustomEvent('odpStatusChanged', {
                detail: { odpId: taskId, status: 'SCHEDULED' }
            }));
            
            if (window.DEBUG) {
                console.log(`Dispatched odpStatusChanged event for task ${taskId}`);
            }
            
            this.show_message(`Task scheduled successfully on ${machine}`, 'success');
            this.refresh_scheduler();
        } catch (error) {
            this.show_message('Failed to schedule task', 'error');
        }
    }
    
    unschedule_event(eventId) {
        try {
            // Get the event details before removing it
            const event = this.storageService.get_scheduled_event_by_id(eventId);
            
            if (window.DEBUG) {
                console.log('Unscheduling event:', event);
            }
            
            this.storageService.remove_scheduled_event(eventId);
            
            // Dispatch custom event for status update if we have the task ID
            if (event && event.taskId) {
                window.dispatchEvent(new CustomEvent('odpStatusChanged', {
                    detail: { odpId: event.taskId, status: 'NOT SCHEDULED' }
                }));
                
                if (window.DEBUG) {
                    console.log(`Dispatched odpStatusChanged event for unscheduled task ${event.taskId}`);
                }
            }
            
            this.show_message('Task unscheduled successfully', 'success');
            this.refresh_scheduler();
        } catch (error) {
            this.show_message('Failed to unschedule task', 'error');
        }
    }
    
    reschedule_event(eventId, newSlot) {
        try {
            // Get the existing event
            const existingEvents = this.storageService.get_scheduled_events();
            const existingEvent = existingEvents.find(event => event.id === eventId);
            
            if (!existingEvent) {
                this.show_message('Event not found', 'error');
                return;
            }
            
            // Calculate new position
            const newMachine = newSlot.dataset.machine;
            const newHour = parseInt(newSlot.dataset.hour);
            const duration = existingEvent.duration || 1;
            
            // Check if the new position is valid
            if (!this.can_schedule_task(newMachine, newHour, duration, eventId)) {
                this.show_message('Cannot reschedule task to this time slot', 'error');
                return;
            }
            
            // Remove the old event
            this.storageService.remove_scheduled_event(eventId);
            
            // Create the new event with updated position
            const newEvent = {
                ...existingEvent,
                machine: newMachine,
                date: this.format_date(this.currentDate),
                startHour: newHour,
                endHour: newHour + duration
            };
            
            // Add the rescheduled event
            this.storageService.add_scheduled_event(newEvent);
            
            // Dispatch custom event for status update with new start time info
            if (existingEvent.taskId) {
                // Calculate the new start timestamp
                const newStartDate = new Date(this.format_date(this.currentDate));
                newStartDate.setHours(newHour, 0, 0, 0);
                
                if (window.DEBUG) {
                    console.log('Reschedule calculation details:');
                    console.log('- Current date:', this.currentDate);
                    console.log('- Formatted date:', this.format_date(this.currentDate));
                    console.log('- New hour:', newHour);
                    console.log('- Calculated start date:', newStartDate);
                    console.log('- ISO string:', newStartDate.toISOString());
                }
                
                window.dispatchEvent(new CustomEvent('odpStatusChanged', {
                    detail: { 
                        odpId: existingEvent.taskId, 
                        status: 'SCHEDULED',
                        isReschedule: true,
                        newStartTime: newStartDate.toISOString(),
                        newMachine: newMachine,
                        newHour: newHour
                    }
                }));
                
                if (window.DEBUG) {
                    console.log(`Dispatched reschedule event for task ${existingEvent.taskId} with new start time: ${newStartDate.toISOString()}`);
                }
            }
            
            this.show_message(`Task rescheduled successfully to ${newMachine}`, 'success');
            this.refresh_scheduler();
            
        } catch (error) {
            console.error('Error rescheduling event:', error);
            this.show_message('Failed to reschedule task', 'error');
        }
    }
    
    can_schedule_task(machine, startHour, duration, excludeEventId = null) {
        const endHour = startHour + duration;
        
        // Check if within working hours (0-24)
        if (startHour < 0 || endHour > 24) {
            return false;
        }
        
        // Check for conflicts with existing events
        const dateKey = this.format_date(this.currentDate);
        const existingEvents = this.storageService.get_events_by_date(dateKey);
        
        for (const event of existingEvents) {
            // Skip the event we're moving (for rescheduling)
            if (excludeEventId && event.id === excludeEventId) {
                continue;
            }
            
            if (event.machine === machine) {
            // Check for time overlap
                if (startHour < event.endHour && endHour > event.startHour) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    get_task_color(task) {
        return task.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    get_task_duration(task) {
        const duration = parseFloat(task.duration) || 1;
        return Math.max(0.1, Math.round(duration * 10) / 10);
    }
    
    render_scheduled_events() {
        // Clear existing events
        this.elements.calendar_container.querySelectorAll('.scheduled-event').forEach(el => el.remove());
        
        const dateKey = this.format_date(this.currentDate);
        const events = this.storageService.get_events_by_date(dateKey);
        
        events.forEach(event => {
            this.render_event(event);
        });
    }
    
    render_event(event) {
        const machineRow = this.elements.calendar_container.querySelector(`[data-machine="${event.machine}"]`);
        if (!machineRow) return;
        
        const slots = machineRow.querySelector('.machine-slots');
        if (!slots) return;
        
        const eventElement = document.createElement('div');
        eventElement.className = 'scheduled-event';
        eventElement.dataset.eventId = event.id;
        eventElement.dataset.taskId = event.taskId;
        eventElement.style.background = event.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        
        const duration = event.endHour - event.startHour;
        const startIndex = event.startHour;
        const slotPercentage = 100 / 24;
        const leftPosition = startIndex * slotPercentage;
        const width = duration * slotPercentage;
        
        eventElement.style.position = 'absolute';
        eventElement.style.left = `${leftPosition}%`;
        eventElement.style.width = `${width}%`;
        eventElement.style.height = '90%';
        eventElement.style.top = '5%';
        eventElement.textContent = event.taskTitle;
        eventElement.draggable = true;
        
        // Make event draggable for unscheduling
        eventElement.addEventListener('dragstart', (e) => {
            this.dragState.isDragging = true;
            this.dragState.draggedElement = eventElement;
            this.dragState.dragType = 'event';
            
            eventElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', event.id);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        eventElement.addEventListener('dragend', (e) => {
            this.dragState.isDragging = false;
            this.dragState.draggedElement = null;
            this.dragState.dragType = null;
            eventElement.classList.remove('dragging');
        });
        
        slots.appendChild(eventElement);
    }
    
    format_date(date) {
        return Utils.format_date(date);
    }
    
    show_message(message, type) {
        const messageEl = this.elements.message_container;
        
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
    
    go_to_today() {
        this.currentDate = new Date();
        this.currentDate.setHours(0, 0, 0, 0);
        this.update_date_display();
        this.render_calendar();
    }
    
    previous_day() {
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        this.update_date_display();
        this.render_calendar();
    }
    
    next_day() {
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.update_date_display();
        this.render_calendar();
    }
    
    update_date_display() {
        if (this.elements.current_date) {
            const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (this.currentDate.getTime() === today.getTime()) {
            this.elements.current_date.textContent = 'Today';
        } else {
            this.elements.current_date.textContent = this.currentDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric'
            });
            }
        }
    }
    
    refresh_scheduler() {
        this.load_tasks();
        this.render_calendar();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the scheduler page
    if (document.getElementById('calendar_container')) {
        window.scheduler = new Scheduler();
        

        
        // Listen for data change events for real-time updates
        window.addEventListener('dataChange', (e) => {
            const { dataType, action } = e.detail;
            
            if (dataType === 'machines' || dataType === 'tasks') {
                if (window.scheduler) {
                    window.scheduler.refresh_scheduler();
                }
            }
        });
    }
});
