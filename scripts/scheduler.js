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
        if (!this.bind_elements()) {
            console.error('Scheduler initialization failed: Required DOM elements not found');
            return false;
        }
        
        this.attach_event_listeners();
        this.update_date_display();
        
        // Load data asynchronously but don't block initialization
        this.load_tasks().catch(error => {
            console.error('Error loading tasks:', error);
        });
        
        this.render_calendar().catch(error => {
            console.error('Error rendering calendar:', error);
        });
        
        return true;
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
    
    async load_tasks() {
        const taskPool = this.elements.task_pool;
        
        // Clear the task pool completely
        taskPool.innerHTML = '';
        
        try {
            // Get available tasks (ODP orders that aren't scheduled)
            const allOrders = await this.storageService.get_odp_orders();
            const scheduledEvents = await this.storageService.get_scheduled_events();
            const scheduledTaskIds = new Set(scheduledEvents.map(event => event.taskId));
            
            const availableTasks = allOrders.filter(order => !scheduledTaskIds.has(order.id));
            
            if (availableTasks.length === 0) {
                taskPool.innerHTML = '<div class="empty-state">No tasks available for scheduling</div>';
                return;
            }
            
            availableTasks.forEach(task => {
                this.create_task_element(task);
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
            taskPool.innerHTML = '<div class="empty-state">Error loading tasks</div>';
        }
    }
    
    create_task_element(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.draggable = true;
        taskElement.dataset.taskId = task.id;
        taskElement.style.background = this.get_task_color(task);
        
        const duration = this.get_task_duration(task);
        
        taskElement.innerHTML = `
            <span>${task.odp_number || 'Unknown Task'}</span>
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
    
    async render_calendar() {
        try {
            // Get only active machines for scheduling
            const allMachines = await this.storageService.get_machines();
            
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
            await this.render_scheduled_events();
        } catch (error) {
            console.error('Error rendering calendar:', error);
            const calendarContainer = this.elements.calendar_container;
            calendarContainer.innerHTML = '<div class="empty-state">Error loading calendar</div>';
        }
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
        return machine.machine_name || machine.id || 'Unknown Machine';
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
        
        // Create 15-minute interval headers (96 slots total)
        for (let slot = 0; slot < 96; slot++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot-header';
            const hour = Math.floor(slot / 4);
            const minute = (slot % 4) * 15;
            
            // Only show hour markers, leave 15-minute slots empty for cleaner look
            timeSlot.textContent = minute === 0 ? `${hour.toString().padStart(2, '0')}` : '';
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
        
        // Create 15-minute interval slots (96 slots total)
        for (let slot = 0; slot < 96; slot++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const hour = Math.floor(slot / 4);
            const minute = (slot % 4) * 15;
            timeSlot.dataset.hour = hour;
            timeSlot.dataset.minute = minute;
            timeSlot.dataset.slot = slot;
            timeSlot.dataset.machine = this.get_machine_display_name(machine);
            
            // Check if this 15-minute slot is unavailable for the machine
            const dateStr = Utils.format_date(this.currentDate);
            const machineName = this.get_machine_display_name(machine);
            
            // TEMPORARILY DISABLED: Machine availability check causing database overload
            // TODO: Re-enable when machine_availability table is properly configured
            /*
            // Check machine availability asynchronously (non-blocking)
            this.storageService.get_machine_availability_for_date(machineName, dateStr)
                .then(unavailableHours => {
                    if (unavailableHours && Array.isArray(unavailableHours) && unavailableHours.includes(hour)) {
                        timeSlot.classList.add('unavailable');
                        timeSlot.style.pointerEvents = 'none'; // Disable drop zone for unavailable slots
                    }
                })
                .catch(() => {
                    // Silently ignore availability check errors to prevent console spam
                });
            */
            
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
    




    /**
     * Schedule a task across multiple days
     */
    async schedule_multi_day_task(taskId, taskData, machine, startDateTime, endDateTime) {
        const duration = this.get_task_duration(taskData);
        
        // Validate that the duration matches the time span
        const startDate = new Date(startDateTime);
        const endDate = new Date(endDateTime);
        const timeSpanHours = (endDate - startDate) / (1000 * 60 * 60);
        
        if (Math.abs(timeSpanHours - duration) > 0.1) { // Allow small rounding differences
            this.show_message(`Task duration (${duration}h) doesn't match time span (${timeSpanHours.toFixed(1)}h)`, 'error');
            return;
        }
        
        // Check if the machine is available for the entire time span
        if (!(await this.can_schedule_multi_day_task(machine, startDateTime, endDateTime))) {
            this.show_message('Cannot schedule task - machine unavailable for this time span', 'error');
            return;
        }
        
        // Create multi-day event
        const event = {
            id: crypto.randomUUID(),
            taskId: taskId,
            taskTitle: taskData.odp_number || 'Unknown Task',
            machine: machine,
            start_time: startDateTime,
            end_time: endDateTime,
            duration: duration,
            color: this.get_task_color(taskData),
            // Legacy compatibility - calculate from datetime
            date: startDate.toLocaleDateString('en-GB'),
            startHour: startDate.getHours(),
            endHour: endDate.getHours()
        };
        
        try {
            await this.storageService.add_scheduled_event(event);
            
            // Dispatch custom event for status update
            window.dispatchEvent(new CustomEvent('odpStatusChanged', {
                detail: { odpId: taskId, status: 'SCHEDULED' }
            }));
            
            this.show_message(`Multi-day task scheduled successfully on ${machine}`, 'success');
            this.refresh_scheduler().catch(error => {
                console.error('Error refreshing scheduler:', error);
            });
        } catch (error) {
            console.error('Error scheduling multi-day task:', error);
            this.show_message('Failed to schedule multi-day task', 'error');
        }
    }
    
    /**
     * Check if a machine can be scheduled for a multi-day task
     */
    async can_schedule_multi_day_task(machine, startDateTime, endDateTime) {
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);
        
        // Get all events for the machine across the entire time range
        const allEvents = await this.storageService.get_scheduled_events();
        const machineEvents = allEvents.filter(event => event.machine === machine);
        
        // Check for conflicts with existing events
        for (const event of machineEvents) {
            
            if (event.start_time && event.end_time) {
                // New datetime format - use direct datetime comparison
                const eventStart = new Date(event.start_time);
                const eventEnd = new Date(event.end_time);
                
                if (Utils.datetime_ranges_overlap(start, end, eventStart, eventEnd)) {
                    return false; // Conflict found
                }
            }
        }
        
        return true;
    }
    
    async schedule_task(taskId, taskData, slot) {
        const machine = slot.dataset.machine;
        const hour = parseInt(slot.dataset.hour);
        const minute = parseInt(slot.dataset.minute) || 0;
        const duration = this.get_task_duration(taskData);
        
        // Calculate start and end times using the EXACT same approach as reschedule_event
        // Use the same date parsing method to ensure consistency
        const startDate = new Date(this.currentDate);
        startDate.setHours(hour, minute, 0, 0);
        const endDate = new Date(this.currentDate);
        
        // Handle decimal hours properly: split into whole hours and minutes
        const totalEndHours = hour + duration;
        const wholeHours = Math.floor(totalEndHours);
        const decimalMinutes = Math.round((totalEndHours % 1) * 60);
        
        // Set the end time with proper hour and minute calculation
        endDate.setHours(wholeHours, decimalMinutes, 0, 0);
        
        // Handle multi-day tasks - if end time goes past midnight, adjust the date
        if (hour + duration > 24) {
            // Calculate how many days and hours this task spans
            const totalHours = hour + duration;
            const extraDays = Math.floor(totalHours / 24);
            const remainingHours = Math.round((totalHours % 24) * 100) / 100; // Round to 2 decimal places
            
            // Create a new end date to avoid modifying the original
            const calculatedEndDate = new Date(this.currentDate);
            calculatedEndDate.setDate(calculatedEndDate.getDate() + extraDays);
            calculatedEndDate.setHours(Math.floor(remainingHours), Math.round((remainingHours % 1) * 60), 0, 0);
            
            // Update the endDate with the calculated value
            endDate.setTime(calculatedEndDate.getTime());
            

        }
        
        // Create event with new datetime structure
        const event = {
            id: crypto.randomUUID(), // Generate a proper UUID
            taskId: taskId,
            taskTitle: taskData.odp_number || 'Unknown Task',
            machine: machine,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            color: this.get_task_color(taskData)
            // Duration is now computed in the database
        };
        
        // Validate scheduling - use the updated conflict detection
        if (!(await this.can_schedule_task(machine, hour, minute, duration, null, taskId))) {
            // Check if the task is already scheduled somewhere
            const allEvents = await this.storageService.get_scheduled_events();
            const existingTaskEvents = allEvents.filter(event => event.taskId === taskId);
            
            if (existingTaskEvents.length > 0) {
                this.show_message(`Task ${taskData.odp_number || 'Unknown'} is already scheduled on ${existingTaskEvents[0].machine}`, 'error');
            } else {
            this.show_message('Cannot schedule task at this time', 'error');
            }
            return;
        }
        
        try {
            await this.storageService.add_scheduled_event(event);
            
            // Dispatch custom event for status update
            window.dispatchEvent(new CustomEvent('odpStatusChanged', {
                detail: { odpId: taskId, status: 'SCHEDULED' }
            }));
            
            this.show_message(`Task scheduled successfully on ${machine}`, 'success');
            
            // Add a small delay before refreshing to ensure database consistency
            setTimeout(() => {
                this.refresh_scheduler().catch(error => {
                    console.error('Error refreshing scheduler:', error);
                });
            }, 500);
        } catch (error) {
            console.error('Error scheduling task:', error);
            this.show_message('Failed to schedule task', 'error');
        }
    }
    
    async unschedule_event(eventId) {
        try {
            // Get the event details before removing it
            const event = await this.storageService.get_scheduled_event_by_id(eventId);
            

            
            await this.storageService.remove_scheduled_event(eventId);
            
            // Dispatch custom event for status update if we have the task ID
            if (event && event.taskId) {
                window.dispatchEvent(new CustomEvent('odpStatusChanged', {
                    detail: { odpId: event.taskId, status: 'NOT SCHEDULED' }
                }));
                

            }
            
            this.show_message('Task unscheduled successfully', 'success');
            this.refresh_scheduler().catch(error => {
                console.error('Error refreshing scheduler:', error);
            });
        } catch (error) {
            console.error('Error unscheduling event:', error);
            this.show_message('Failed to unschedule task', 'error');
        }
    }
    
    async reschedule_event(eventId, newSlot) {
        try {
            // Get the existing event
            const existingEvents = await this.storageService.get_scheduled_events();
            const existingEvent = existingEvents.find(event => event.id === eventId);
            
            if (!existingEvent) {
                this.show_message('Event not found', 'error');
                return;
            }
            
            // Calculate new position
            const newMachine = newSlot.dataset.machine;
            const newHour = parseInt(newSlot.dataset.hour);
            const newMinute = parseInt(newSlot.dataset.minute) || 0;
            
            // Calculate duration from datetime fields since we removed the duration field
            let duration;
            if (existingEvent.start_time && existingEvent.end_time) {
                const startTime = new Date(existingEvent.start_time);
                const endTime = new Date(existingEvent.end_time);
                duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                
                // Ensure duration is positive and reasonable
                if (duration <= 0 || duration > 24) {
                    duration = 1; // Fallback to 1 hour
                }
            } else {
                // Fallback to 1 hour if no datetime fields (shouldn't happen anymore)
                duration = 1;
            }
            
            // Check if the new position is valid
            if (!(await this.can_schedule_task(newMachine, newHour, newMinute, duration, eventId, existingEvent.taskId))) {
                this.show_message('Cannot reschedule task to this time slot', 'error');
                return;
            }
            
            // Remove the old event
            await this.storageService.remove_scheduled_event(eventId);
            
            // Calculate new start and end times
            // CRITICAL FIX: Use the current date for rescheduling, but preserve exact duration
            const newStartDate = new Date(this.currentDate);
            newStartDate.setHours(newHour, newMinute, 0, 0);
            const newEndDate = new Date(newStartDate);
            
            // Add the exact duration to preserve task length
            newEndDate.setTime(newStartDate.getTime() + (duration * 60 * 60 * 1000));
            

            
            // Handle multi-day tasks - if end time goes past midnight, adjust the date
            if (newHour + duration > 24) {
                // Calculate how many days and hours this task spans
                const totalHours = newHour + duration;
                const extraDays = Math.floor(totalHours / 24);
                const remainingHours = Math.round((totalHours % 24) * 100) / 100; // Round to 2 decimal places
                
                // CRITICAL FIX: Use the original event's date for multi-day calculations
                const calculatedEndDate = new Date(originalEventDate);
                calculatedEndDate.setDate(calculatedEndDate.getDate() + extraDays);
                calculatedEndDate.setHours(Math.floor(remainingHours), Math.round((remainingHours % 1) * 60), 0, 0);
                
                // Update the newEndDate with the calculated value
                newEndDate.setTime(calculatedEndDate.getTime());
                

            }
            

            
            // Final verification: ensure the duration is correct
            const actualDuration = (newEndDate.getTime() - newStartDate.getTime()) / (1000 * 60 * 60);
            
            // Validate that the event data is correct before sending to database
            if (newEndDate <= newStartDate) {
                throw new Error(`Invalid event: end time must be after start time`);
            }
            
            if (newHour < 0 || newHour > 23) {
                throw new Error(`Invalid start hour: ${newHour}`);
            }
            
            const calculatedEndHour = newHour + duration > 24 ? Math.round(((newHour + duration) % 24) * 100) / 100 || 24 : Math.round((newHour + duration) * 100) / 100;
            if (calculatedEndHour < 0 || calculatedEndHour > 24) {
                throw new Error(`Invalid end hour: ${calculatedEndHour}`);
            }
            

            
            // Create the new event with updated position and new datetime structure
            const newEvent = {
                ...existingEvent,
                machine: newMachine,
                start_time: newStartDate.toISOString(),
                end_time: newEndDate.toISOString()
                // Legacy fields removed - no more constraint violations!
            };
            
            // Add the rescheduled event
            await this.storageService.add_scheduled_event(newEvent);
            
            // Dispatch custom event for status update with new start time info
            if (existingEvent.taskId) {
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
            }
            
            this.show_message(`Task rescheduled successfully to ${newMachine}`, 'success');
            
            // Add a small delay before refreshing to ensure database consistency
            setTimeout(() => {
                this.refresh_scheduler().catch(error => {
                    console.error('Error refreshing scheduler:', error);
                });
            }, 500);
            
        } catch (error) {
            console.error('Error rescheduling event:', error);
            this.show_message('Failed to reschedule task', 'error');
        }
    }
    
    async can_schedule_task(machine, startHour, startMinute = 0, duration, excludeEventId = null, taskId = null) {
        const endHour = startHour + duration;
        
        // Check if this is a multi-day task
        if (endHour > 24) {
            
            // Calculate the actual datetime range for multi-day tasks
            const startDate = new Date(this.currentDate);
            startDate.setHours(startHour, startMinute, 0, 0);
            const endDate = new Date(this.currentDate);
            endDate.setHours(endHour, 0, 0, 0);
            
            // Handle multi-day rollover
            if (endHour > 24) {
                const extraDays = Math.floor(endHour / 24);
                const remainingHours = endHour % 24;
                endDate.setDate(endDate.getDate() + extraDays);
                endDate.setHours(remainingHours, 0, 0, 0);
            }
            
            // Use the multi-day conflict detection
            const canSchedule = await this.can_schedule_multi_day_task(machine, startDate.toISOString(), endDate.toISOString());
            return canSchedule;
        }
        
        // For single-day tasks, check if within working hours (0-24)
        if (startHour < 0 || endHour > 24) {
            return false;
        }
        
        // CRITICAL FIX: Check if the same task is already scheduled anywhere
        if (taskId && !excludeEventId) {
            const allEvents = await this.storageService.get_scheduled_events();
            const existingTaskEvents = allEvents.filter(event => event.taskId === taskId);
            
            if (existingTaskEvents.length > 0) {
                // Task is already scheduled somewhere - prevent duplicate scheduling
                return false;
            }
        }
        
        // Get events for the current date
        const events = await this.storageService.get_events_by_date(Utils.format_date(this.currentDate));
        const machineEvents = events.filter(event => event.machine === machine);
        
        // Check for conflicts using datetime fields
        for (const event of machineEvents) {
            // Skip the event we're moving (for rescheduling)
            if (excludeEventId && event.id === excludeEventId) {
                continue;
            }
            
            if (event.start_time && event.end_time) {
                const eventStart = new Date(event.start_time);
                const eventEnd = new Date(event.end_time);
                const newStart = new Date(this.currentDate);
                newStart.setHours(startHour, startMinute, 0, 0);
                const newEnd = new Date(this.currentDate);
                newEnd.setHours(endHour, 0, 0, 0);
                
                if (Utils.datetime_ranges_overlap(newStart, newEnd, eventStart, eventEnd)) {
                    return false; // Conflict found
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
    
    async render_scheduled_events() {
        try {
            // Clear existing events
            this.elements.calendar_container.querySelectorAll('.scheduled-event').forEach(el => el.remove());
            
            // Check connection status first
            const connectionStatus = await this.storageService.check_connection();
            if (!connectionStatus.connected) {
                console.warn('Database connection issue:', connectionStatus.error);
                this.show_message(`Database connection issue: ${connectionStatus.error}`, 'warning');
                
                // Try to use cached data
                const cachedEvents = this.storageService.cache?.get('scheduled_events');
                if (cachedEvents && cachedEvents.data && cachedEvents.data.length > 0) {
                    console.log('Using cached events due to connection issue');
                    this.show_message('Using cached data due to connection issue', 'warning');
                    this.render_cached_events(cachedEvents.data);
                    return;
                }
            }
            
            // Get all scheduled events (not just current date)
            let allEvents;
            
            // Simple retry mechanism for database overload
            const maxRetries = 3;
            let retryCount = 0;
            
            while (retryCount < maxRetries) {
                try {
                    // Add small delay to prevent overwhelming the database
                    if (retryCount > 0) {
                        const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
                        console.log(`Retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    allEvents = await this.storageService.get_scheduled_events();
                    break; // Success, exit retry loop
                } catch (error) {
                    retryCount++;
                    console.error(`Error fetching scheduled events (attempt ${retryCount}/${maxRetries}):`, error);
                    
                    if (retryCount >= maxRetries) {
                        // Final attempt failed, handle error
                        break;
                    }
                }
            }
            
            // If all retries failed, handle the error
            if (!allEvents) {
                console.error('All retry attempts failed for fetching scheduled events');
                
                // Try to use cached data as fallback
                const cachedEvents = this.storageService.cache?.get('scheduled_events');
                if (cachedEvents && cachedEvents.data && cachedEvents.data.length > 0) {
                    console.log('Using cached events due to all retries failing');
                    this.show_message('Using cached data due to database issues', 'warning');
                    this.render_cached_events(cachedEvents.data);
                    return;
                }
                
                // If no cached data, show error message
                this.show_message('Unable to load scheduled events. Please refresh the page.', 'error');
                return;
            }
            
            // Check if we got events or if there was a network issue
            if (!allEvents || allEvents.length === 0) {
                // Check if this is due to a network issue
                const cachedEvents = this.storageService.cache?.get('scheduled_events');
                if (cachedEvents && cachedEvents.data && cachedEvents.data.length > 0) {
                    console.log('Using cached events due to network issue');
                    this.show_message('Using cached data due to network connectivity issue', 'warning');
                    this.render_cached_events(cachedEvents.data);
                } else {
                    console.log('No scheduled events found');
                }
                return;
            }
            
            // Filter events that should be visible on the current date
            const visibleEvents = allEvents.filter(event => {
                if (event.start_time && event.end_time) {
                    // New datetime format - check if event overlaps with current date
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);
                    const currentDateStart = new Date(this.currentDate);
                    currentDateStart.setHours(0, 0, 0, 0);
                    const currentDateEnd = new Date(this.currentDate);
                    currentDateEnd.setHours(23, 59, 59, 999);
                    
                    // Check if event overlaps with current date
                    const overlaps = Utils.datetime_ranges_overlap(eventStart, eventEnd, currentDateStart, currentDateEnd);
                    
                    return overlaps;
                }
                // Legacy format fallback removed - all events must have datetime fields
                return false; // Explicitly return false for events without datetime fields
            });
            
            visibleEvents.forEach(event => {
                // Handle multi-day events
                if (event.start_time && event.end_time) {
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);
                    const isMultiDay = eventStart.toDateString() !== eventEnd.toDateString();
                }
                
                this.render_event(event);
            });
        } catch (error) {
            console.error('Error rendering scheduled events:', error);
            
            // Show user-friendly error message
            if (error.message && error.message.includes('Failed to fetch')) {
                this.show_message('Network connectivity issue. Please check your internet connection.', 'error');
                
                // Try to use cached data as fallback
                const cachedEvents = this.storageService.cache?.get('scheduled_events');
                if (cachedEvents && cachedEvents.data && cachedEvents.data.length > 0) {
                    console.log('Using cached events due to network error');
                    this.show_message('Using cached data due to network error', 'warning');
                    this.render_cached_events(cachedEvents.data);
                }
            } else {
                this.show_message('Error loading scheduled events', 'error');
            }
        }
    }
    
    /**
     * Render events from cached data when network is unavailable
     */
    render_cached_events(cachedEvents) {
        try {
            // Filter cached events that should be visible on the current date
            const visibleEvents = cachedEvents.filter(event => {
                if (event.start_time && event.end_time) {
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);
                    const currentDateStart = new Date(this.currentDate);
                    currentDateStart.setHours(0, 0, 0, 0);
                    const currentDateEnd = new Date(this.currentDate);
                    currentDateEnd.setHours(23, 59, 59, 999);
                    
                    const overlaps = Utils.datetime_ranges_overlap(eventStart, eventEnd, currentDateStart, currentDateEnd);
                    return overlaps;
                }
                return false;
            });
            
            visibleEvents.forEach(event => {
                this.render_event(event);
            });
            
            console.log(`Rendered ${visibleEvents.length} events from cache`);
        } catch (error) {
            console.error('Error rendering cached events:', error);
        }
    }
    
    render_event(event) {
        const machineRow = this.elements.calendar_container.querySelector(`[data-machine="${event.machine}"]`);
        if (!machineRow) {
            return;
        }
        
        const slots = machineRow.querySelector('.machine-slots');
        if (!slots) {
            return;
        }
        
        const eventElement = document.createElement('div');
        eventElement.className = 'scheduled-event';
        eventElement.dataset.eventId = event.id;
        eventElement.dataset.taskId = event.taskId;
        eventElement.style.background = event.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        
        // Calculate positioning based on new datetime structure
        let startHour, endHour, duration;
        
        // Always create datetime objects for positioning calculation
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        
        // Validate that we have valid dates
        if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
            console.error(`Invalid dates for event ${event.taskTitle}:`, {
                startTime: event.start_time,
                endTime: event.end_time
            });
            return;
        }
        
        if (event.start_time && event.end_time) {
            // New datetime format
            const currentDateStart = new Date(this.currentDate);
            currentDateStart.setHours(0, 0, 0, 0);
            const currentDateEnd = new Date(this.currentDate);
            currentDateEnd.setHours(23, 59, 59, 999);
            
            // Check if this is a multi-day event
            const isMultiDay = eventStart.toDateString() !== eventEnd.toDateString();
            
            // Calculate the total days this event spans
            const totalEventDays = Math.ceil((eventEnd - eventStart) / (1000 * 60 * 60 * 24));
            
            if (isMultiDay && eventStart.toDateString() === this.currentDate.toDateString()) {
                // This is the start of a multi-day event - show it extending to the end of the day
                startHour = eventStart.getHours();
                endHour = 24;
                duration = 24 - startHour;
                
                // Add visual indicator for multi-day events
                eventElement.classList.add('multi-day-start');
                eventElement.title = `${event.taskTitle} (Multi-day event starting today - continues tomorrow)`;
                
            } else if (isMultiDay && eventEnd.toDateString() === this.currentDate.toDateString()) {
                // This is the end of a multi-day event - show it from the start of the day until the actual end time
                startHour = 0;
                endHour = eventEnd.getHours();
                duration = endHour;
                
                // If the event ends at exactly midnight (00:00), don't show it on this day
                if (endHour === 0) {
                    return; // Don't render this event on the end day
                }
                
                eventElement.classList.add('multi-day-end');
                eventElement.title = `${event.taskTitle} (Multi-day event ending today at ${endHour}:00 - started yesterday)`;
                
            } else if (isMultiDay && totalEventDays > 2 && eventStart < currentDateStart && eventEnd > currentDateEnd) {
                // This is a middle day of a multi-day event (3+ days) - show it spanning the full day
                startHour = 0;
                endHour = 24;
                duration = 24;
                
                eventElement.classList.add('multi-day-middle');
                const daysFromStart = Math.floor((this.currentDate - eventStart) / (1000 * 60 * 60 * 24));
                eventElement.title = `${event.taskTitle} (Multi-day event - day ${daysFromStart + 1})`;
                
            } else if (isMultiDay) {
                // This is a multi-day event but we're viewing a day that's not start, middle, or end
                // This can happen when the event spans exactly 2 days and we're viewing the second day
                // In this case, we should show from 00:00 to the actual end time
                startHour = 0;
                endHour = eventEnd.getHours();
                duration = endHour;
                
                // If the event ends at exactly midnight (00:00), don't show it on this day
                if (endHour === 0) {
                    return; // Don't render this event on this day
                }
                
                eventElement.classList.add('multi-day-end');
                eventElement.title = `${event.taskTitle} (Multi-day event ending today at ${endHour}:00)`;
                
            } else {
                // Single-day event or event that starts/ends on current day
                startHour = Math.max(0, eventStart.getHours());
                endHour = Math.min(24, eventEnd.getHours());
                duration = endHour - startHour;
                
                // Adjust if event starts before current day
                if (eventStart < currentDateStart) {
                    startHour = 0;
                    duration = endHour;
                }
                
                // Adjust if event ends after current day
                if (eventEnd > currentDateEnd) {
                    endHour = 24;
                    duration = 24 - startHour;
                }
            }
        }
        
        // All events must have datetime fields - no more legacy fallback
        
        // Calculate precise positioning using 15-minute slots for granular display
        const totalSlots = 96; // 24 hours × 4 slots per hour
        
        // Calculate slots directly from datetime values for accuracy
        const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
        const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
        
        const startSlot = Math.floor(startMinutes / 15);
        const endSlot = Math.ceil(endMinutes / 15);
        const durationSlots = endSlot - startSlot;
        
        // Convert to percentages for precise positioning (96 slots = 100%)
        const leftPosition = (startSlot / totalSlots) * 100;
        const width = (durationSlots / totalSlots) * 100;
        

        
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
        this.render_calendar().catch(error => {
            console.error('Error rendering calendar:', error);
        });
        // Also refresh scheduled events for the new date
        this.render_scheduled_events().catch(error => {
            console.error('Error rendering scheduled events:', error);
        });
    }
    
    previous_day() {
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        this.update_date_display();
        this.render_calendar().catch(error => {
            console.error('Error rendering calendar:', error);
        });
        // Also refresh scheduled events for the new date
        this.render_scheduled_events().catch(error => {
            console.error('Error rendering scheduled events:', error);
        });
    }
    
    next_day() {
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.update_date_display();
        this.render_calendar().catch(error => {
            console.error('Error rendering calendar:', error);
        });
        // Also refresh scheduled events for the new date
        this.render_scheduled_events().catch(error => {
            console.error('Error rendering scheduled events:', error);
        });
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
    
    async refresh_scheduler() {
        await this.load_tasks();
        await this.render_calendar();
    }
}

// Initialize when storage service is ready
const initializeScheduler = () => {
    // Only initialize if we're on the scheduler page and storage service is ready
    if (document.getElementById('calendar_container')) {
        if (!window.storageService || !window.storageService.initialized) {
            return;
        }
        
        // Force clean initialization - remove any existing incomplete scheduler
        if (window.scheduler) {
            delete window.scheduler;
        }
        
        try {
            window.scheduler = new Scheduler();
        } catch (error) {
            console.error('Error initializing Scheduler:', error);
        }
    }
};

// Only listen for the event - no fallback that could cause premature initialization
window.addEventListener('storageServiceReady', initializeScheduler);

// Listen for data change events for real-time updates
window.addEventListener('dataChange', (e) => {
    const { dataType, action } = e.detail;
    
    if (dataType === 'machines' || dataType === 'tasks') {
        if (window.scheduler) {
            window.scheduler.refresh_scheduler().catch(error => {
                console.error('Error refreshing scheduler from data change event:', error);
            });
        }
    }
});
