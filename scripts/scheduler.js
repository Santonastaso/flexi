/** * Production Scheduler - Fixed Implementation 
 * Uses existing CSS structure and StorageService API 
 */

// Import dependencies 
import { BusinessLogicService } from './businessLogicService.js';
import { Utils } from './utils.js';

export class Scheduler {
    constructor(storage_service = null, business_logic_service = null) {
        this.storage_service = storage_service || window.storageService;
        this.business_logic = business_logic_service || new BusinessLogicService();
        this.current_date = new Date();
        this.current_date.setHours(0, 0, 0, 0);

        this.elements = {};
        this.drag_state = {
            is_dragging: false,
            dragged_element: null,
            drag_type: null // 'task' or 'event' 
        };

        // Don't auto-initialize - let the caller do it when ready 
        // this.init(); 
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
        const missingKeys = Object.keys(this.elements).filter(key => !this.elements[key]);

        if (missingKeys.length > 0) {
            console.error('Missing required elements:', missingKeys);
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
            if (eventId && this.drag_state.drag_type === 'event') {
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
            const allOrders = await this.storage_service.get_odp_orders();
            console.log('All ODP orders:', allOrders.map(o => ({ id: o.id, odp_number: o.odp_number, status: o.status, scheduled_machine_id: o.scheduled_machine_id })));
            
            // Simple state machine: if status !== 'SCHEDULED', show in task pool
            const availableTasks = allOrders.filter(order => order.status !== 'SCHEDULED');
            console.log('Available tasks for pool:', availableTasks.map(t => ({ id: t.id, odp_number: t.odp_number, status: t.status })));

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
            this.drag_state.is_dragging = true;
            this.drag_state.dragged_element = taskElement;
            this.drag_state.drag_type = 'task';

            taskElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
            e.dataTransfer.setData('application/json', JSON.stringify(task));
            e.dataTransfer.effectAllowed = 'move';
        });

        taskElement.addEventListener('dragend', (e) => {
            this.drag_state.is_dragging = false;
            this.drag_state.dragged_element = null;
            this.drag_state.drag_type = null;
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
            const allMachines = await this.storage_service.get_machines();

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

    /** * Refresh calendar to reflect machine availability changes 
     */
    refresh_calendar() {
        this.render_calendar();
    }
    
    /** * Refresh machine data and update DOM to reflect any machine name changes
     */
    async refresh_machine_data() {
        try {
            // Clear cache to get fresh machine data
            this.storage_service.clear_cache('machines');
            
            // Re-render calendar with updated machine names
            await this.render_calendar();
            
            console.log('Machine data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing machine data:', error);
        }
    }

    /** * Get machines that are available for production scheduling 
     * @param {Array} machines - All machines 
     * @returns {Array} - Active machines only 
     */
    get_active_machines(machines) {
        return machines.filter(m => (m.status ? m.status.toUpperCase() === 'ACTIVE' : m.machine_name));
    }

    /** * Get machine display name for UI 
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
        machineRow.dataset.machine = machine.id; // Store machine ID instead of name
        machineRow.dataset.machineName = displayName; // Store display name separately

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
            timeSlot.dataset.machine = machine.id; // Store machine ID instead of name
            timeSlot.dataset.machineName = this.get_machine_display_name(machine); // Store display name separately

            // Check if this 15-minute slot is unavailable for the machine 
            const dateStr = Utils.format_date(this.current_date);
            const machineName = this.get_machine_display_name(machine);

            // TEMPORARILY DISABLED: Machine availability check causing database overload 
            // TODO: Re-enable when machine_availability table is properly configured 
            /* // Check machine availability asynchronously (non-blocking) 
            this.storage_service.get_machine_availability_for_date(machineName, dateStr) 
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
            if (this.drag_state.is_dragging) {
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
            if (taskId && this.drag_state.drag_type === 'task') {
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
            } else if (taskId && this.drag_state.drag_type === 'event') {
                // Handle moving existing events (rescheduling) 
                this.reschedule_event(taskId, slot);
            }
        });
    }

    /** * Schedule a task across multiple days 
     */
    async schedule_multi_day_task(taskId, taskData, machine, startDateTime, endDateTime) {
        const duration = this.get_task_duration(taskData);

        // Validate that the duration matches the time span 
        const startDate = new Date(startDateTime);
        const endDate = new Date(endDateTime);
        const timeSpanHours = (endDate - startDate) / 3600000;

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
            await this.storage_service.add_scheduled_event(event);

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

    /** * Check if a machine can be scheduled for a multi-day task 
     */
    async can_schedule_multi_day_task(machine, startDateTime, endDateTime) {
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);

        // Get all events for the machine across the entire time range 
        const allEvents = await this.storage_service.get_scheduled_events();

        // Check for conflicts with existing events on the same machine
        const hasConflict = allEvents.some(event => {
            // Compare by machine ID (preferred) or machine name (fallback)
            const machineMatches = event.machineId === machine || event.machine === machine;
            if (!machineMatches || !event.start_time || !event.end_time) {
                return false;
            }
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);
            return Utils.datetime_ranges_overlap(start, end, eventStart, eventEnd);
        });

        return !hasConflict;
    }

    async schedule_task(taskId, taskData, slot) {
        const machine = slot.dataset.machine;
        const hour = parseInt(slot.dataset.hour);
        const minute = parseInt(slot.dataset.minute) || 0;
        const duration = this.get_task_duration(taskData);

        // SIMPLE APPROACH: Duration comes from ODP data, end time = start time + duration 
        const startDate = new Date(this.current_date.getFullYear(), this.current_date.getMonth(), this.current_date.getDate(), hour, minute, 0, 0);

        // End time = Start time + Duration (from ODP data) 
        const endDate = new Date(startDate.getTime() + (duration * 3600000));

        // No complex multi-day calculations needed - the duration handles it automatically 

        // Create event with new datetime structure 
        const event = {
            id: `event_${taskId}_${machine}`, // Generate STABLE event ID matching service pattern 
            taskId: taskId,
            taskTitle: taskData.odp_number || 'Unknown Task',
            machine: machine, // This is now the machine ID
            start_time: startDate.toISOString(), // Store with timezone info to preserve local time 
            end_time: endDate.toISOString(), // Store with timezone info to preserve local time 
            color: this.get_task_color(taskData)
            // Duration is now computed in the database 
        };

        // Debug: Log the timezone conversion to verify it's working correctly 
        console.log('Timezone debug - Task scheduling:', {
            localStart: startDate.toString(),
            localEnd: endDate.toString(),
            utcStart: startDate.toISOString(),
            utcEnd: endDate.toISOString(),
            currentDate: this.current_date.toString(),
            hour: hour,
            duration: duration
        });

                // Check work center compatibility using machine ID
        const machines = await this.storage_service.get_machines();
        const targetMachine = machines.find(m => m.id === machine || m.machine_name === machine);

        // Debug: Log the values to see what's happening 
        console.log('Work center check:', {
            machine: machine,
            taskWorkCenter: taskData.work_center,
            targetMachine: targetMachine,
            machineWorkCenter: targetMachine?.work_center
        });
        
        // Debug: Show all available machines
        console.log('Available machines in database:', machines.map(m => ({ id: m.id, name: m.machine_name, workCenter: m.work_center })));
        console.log('Machine being scheduled on:', machine);
        
        if (!targetMachine) {
            // Machine not found - this might be due to a name change
            console.warn(`Machine "${machine}" not found in database. Available machines:`, machines.map(m => m.machine_name));
            
            // Try to refresh machine data and find the machine again
            await this.refresh_machine_data();
            const refreshedMachines = await this.storage_service.get_machines();
            const refreshedTargetMachine = refreshedMachines.find(m => m.id === machine || m.machine_name === machine);
            
            if (!refreshedTargetMachine) {
                this.show_message(`Machine "${machine}" not found. Please refresh the page to see updated machine names.`, 'error');
                return;
            }
            
            // Use the refreshed machine data
            if (refreshedTargetMachine.work_center !== taskData.work_center) {
                this.show_message(`Task can only be scheduled on machines with work center: ${taskData.work_center}`, 'error');
                return;
            }
        } else if (targetMachine.work_center !== taskData.work_center) {
            this.show_message(`Task can only be scheduled on machines with work center: ${taskData.work_center}`, 'error');
            return;
        }

        // Validate scheduling - use the updated conflict detection 
        if (!(await this.can_schedule_task(machine, hour, minute, duration, null, taskId))) {
            // Check if the task is already scheduled somewhere 
            const allEvents = await this.storage_service.get_scheduled_events();
            const existingTaskEvents = allEvents.filter(event => event.taskId === taskId);

            if (existingTaskEvents.length > 0) {
                this.show_message(`Task ${taskData.odp_number || 'Unknown'} is already scheduled on ${existingTaskEvents[0].machine}`, 'error');
            } else {
                this.show_message('Cannot schedule task at this time', 'error');
            }
            return;
        }

        try {
            await this.storage_service.add_scheduled_event(event);

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
            const event = await this.storage_service.get_scheduled_event_by_id(eventId);

            await this.storage_service.remove_scheduled_event(eventId);

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
            const existingEvents = await this.storage_service.get_scheduled_events();
            const existingEvent = existingEvents.find(event => event.id === eventId);

            if (!existingEvent) {
                this.show_message('Event not found', 'error');
                return;
            }

            // Store a copy of the event data for safety 
            const originalEvent = { ...existingEvent };

            // Calculate new position 
            const newMachineId = newSlot.dataset.machine; // This is now the machine ID
            const newHour = parseInt(newSlot.dataset.hour);
            const newMinute = parseInt(newSlot.dataset.minute) || 0;
            
            // Get machine name for display purposes
            const machines = await this.storage_service.get_machines();
            const newMachine = machines.find(m => m.id === newMachineId);
            if (!newMachine) {
                this.show_message('Target machine not found', 'error');
                return;
            }

            // Calculate duration from existing event data, falling back to 1 hour
            let duration = this.calculate_event_duration(existingEvent) || 1;
            if (duration <= 0) {
                duration = 1;
            }

            // Debug: Log the duration calculation 
            console.log('Duration calculation for rescheduling:', {
                taskTitle: existingEvent.taskTitle,
                originalStart: existingEvent.start_time,
                originalEnd: existingEvent.end_time,
                calculatedDuration: duration,
                originalEventKeys: Object.keys(existingEvent)
            });


            // CRITICAL FIX: Add work center validation for rescheduling 
            // Get the task data to check work center compatibility 
            const allOrders = await this.storage_service.get_odp_orders();
            const taskData = allOrders.find(order => order.id === existingEvent.taskId);

            if (taskData) {
                // Check work center compatibility using machine ID
                const targetMachine = machines.find(m => m.id === newMachineId);

                if (!targetMachine || targetMachine.work_center !== taskData.work_center) {
                    this.show_message(`Task can only be scheduled on machines with work center: ${taskData.work_center}`, 'error');
                    return;
                }
            }

            // Check if the new position is valid 
            if (!(await this.can_schedule_task(newMachineId, newHour, newMinute, duration, eventId, existingEvent.taskId))) {
                this.show_message('Cannot reschedule task to this time slot', 'error');
                return;
            }

            // Calculate new start and end times 
            const newStartDate = new Date(this.current_date.getFullYear(), this.current_date.getMonth(), this.current_date.getDate(), newHour, newMinute, 0, 0);
            const newEndDate = new Date(newStartDate.getTime() + (duration * 3600000));

            // Debug: Log the new time calculation 
            console.log('New time calculation for rescheduling:', {
                newHour: newHour,
                newMinute: newMinute,
                duration: duration,
                newStartDate: newStartDate.toString(),
                newEndDate: newEndDate.toString(),
                crossesMidnight: newHour + duration > 24
            });

            // Validate that the event data is correct before sending to database 
            if (newEndDate <= newStartDate) {
                throw new Error(`Invalid event: end time must be after start time`);
            }

            if (newHour < 0 || newHour > 23) {
                throw new Error(`Invalid start hour: ${newHour}`);
            }

            // Create the new event with updated position and new datetime structure 
            const newEvent = {
                ...existingEvent,
                id: `event_${existingEvent.taskId}_${newMachineId}`, // Generate new event ID for new machine
                taskId: existingEvent.taskId, // Ensure taskId is preserved for ODP order update 
                machine: newMachineId, // Use machine ID for database operations
                machineName: newMachine.machine_name, // Store machine name for display
                start_time: newStartDate.toISOString(), // Store with timezone info to preserve local time 
                end_time: newEndDate.toISOString(), // Store with timezone info to preserve local time 
                // Preserve the original multi-day status for rendering purposes 
                originalStartTime: existingEvent.start_time,
                originalEndTime: existingEvent.end_time
                // Legacy fields removed - no more constraint violations! 
            };

            // Debug: Log the timezone conversion to verify it's working correctly 
            console.log('Timezone debug - Task rescheduling:', {
                localStart: newStartDate.toString(),
                localEnd: newEndDate.toString(),
                utcStart: newStartDate.toISOString(),
                utcEnd: newEndDate.toISOString(),
                currentDate: this.current_date.toString(),
                newHour: newHour,
                duration: duration,
                taskId: existingEvent.taskId,
                existingEventKeys: Object.keys(existingEvent),
                oldEventId: existingEvent.id,
                newEventId: newEvent.id,
                sameMachine: newMachine === existingEvent.machine
            });

            // Validate the new event data before sending to database 
            if (!newEvent.id || !newEvent.machine || !newEvent.start_time || !newEvent.end_time) {
                throw new Error('Invalid event data: missing required fields');
            }

            // Since we're using consolidated scheduling, just update the existing event 
            console.log('Updating existing event with new scheduling:', {
                eventId: existingEvent.id,
                oldMachine: existingEvent.machine,
                newMachine: newMachine,
                oldStart: existingEvent.start_time,
                newStart: newEvent.start_time
            });

            // Update the existing event directly 
            console.log('About to update event with:', newEvent);
            await this.storage_service.add_scheduled_event(newEvent);
            console.log('Successfully updated event');
            
            // Debug: Check if the update was successful
            const updatedEvents = await this.storage_service.get_scheduled_events();
            const updatedEvent = updatedEvents.find(e => e.taskId === existingEvent.taskId);
            console.log('Event after update:', updatedEvent);

            // Dispatch custom event for status update with new start time info 
            if (existingEvent.taskId) {
                window.dispatchEvent(new CustomEvent('odpStatusChanged', {
                    detail: {
                        odpId: existingEvent.taskId,
                        status: 'SCHEDULED',
                        isReschedule: true,
                        newStartTime: newStartDate.toISOString(),
                        newHour: newHour
                    }
                }));
            }

            this.show_message(`Task rescheduled successfully to ${newMachine.machine_name}`, 'success');

            // Refresh immediately to show the changes 
            await this.refresh_scheduler();

        } catch (error) {
            console.error('Error rescheduling event:', error);
            this.show_message('Failed to reschedule task', 'error');

            // Try to recover by ensuring the original event still exists 
            try {
                const recoveryCheck = await this.storage_service.get_scheduled_events();
                const eventExists = recoveryCheck.find(event => event.id === eventId);

                if (!eventExists) {
                    console.warn('Original event was lost during failed reschedule, attempting recovery...');
                    // Try to restore the original event if it was lost 
                    const recoveryEvent = {
                        ...originalEvent,
                        id: `event_${originalEvent.taskId}_${originalEvent.machine}` // Use stable ID pattern 
                    };
                    await this.storage_service.add_scheduled_event(recoveryEvent);
                    console.log('Event recovery successful');
                }
            } catch (recoveryError) {
                console.error('Failed to recover event:', recoveryError);
            }
        }
    }

    async can_schedule_task(machine, startHour, startMinute = 0, duration, excludeEventId = null, taskId = null) {
        // SIMPLE APPROACH: Use duration to calculate end time 
        const startDate = new Date(this.current_date.getFullYear(), this.current_date.getMonth(), this.current_date.getDate(), startHour, startMinute, 0, 0);
        const endDate = new Date(startDate.getTime() + (duration * 3600000));

        // Use the multi-day conflict detection for all tasks.
        // The original implementation contained unreachable code after the return statement.
        // That logic has been removed as it had no effect.
        return this.can_schedule_multi_day_task(machine, startDate.toISOString(), endDate.toISOString());
    }

    get_task_color(task) {
        // In the consolidated approach, color comes from the ODP order 
        return task.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    get_task_duration(task) {
        // In the consolidated approach, duration comes from the ODP order 
        const duration = parseFloat(task.duration) || 1;
        return Math.max(0.1, Math.round(duration * 10) / 10);
    }

    async render_scheduled_events() {
        try {
            // Clear existing events 
            this.elements.calendar_container.querySelectorAll('.scheduled-event').forEach(el => el.remove());

            // Check connection status first 
            const connectionStatus = await this.storage_service.check_connection();
            if (!connectionStatus.connected) {
                console.warn('Database connection issue:', connectionStatus.error);
                this.show_message(`Database connection issue: ${connectionStatus.error}`, 'warning');

                // Try to use cached data 
                const cachedEvents = this.storage_service.cache?.get('scheduled_events');
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

                    allEvents = await this.storage_service.get_scheduled_events();
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
                const cachedEvents = this.storage_service.cache?.get('scheduled_events');
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
                const cachedEvents = this.storage_service.cache?.get('scheduled_events');
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
                    const currentDateStart = new Date(this.current_date);
                    currentDateStart.setHours(0, 0, 0, 0);
                    const currentDateEnd = new Date(this.current_date);
                    currentDateEnd.setHours(23, 59, 59, 999);

                    // Check if event overlaps with current date 
                    return Utils.datetime_ranges_overlap(eventStart, eventEnd, currentDateStart, currentDateEnd);
                }
                // Legacy format fallback removed - all events must have datetime fields 
                return false; // Explicitly return false for events without datetime fields 
            });

            visibleEvents.forEach(event => {
                // Handle multi-day events with robust timezone-aware detection 
                let isMultiDay = false;
                if (event.start_time && event.end_time) {
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);

                    // More robust multi-day detection that accounts for timezone differences 
                    const eventDuration = eventEnd.getTime() - eventStart.getTime();
                    const hoursDiff = eventDuration / 3600000;

                    // Event is multi-day if it spans more than 24 hours OR crosses midnight 
                    isMultiDay = hoursDiff > 24 || eventStart.toDateString() !== eventEnd.toDateString();

                    // Enhanced debug logging to show timezone conversion details 
                    const debugInfo = {
                        taskTitle: event.taskTitle,
                        storedStart: event.start_time,
                        storedEnd: event.end_time,
                        eventStartISO: eventStart.toISOString(),
                        eventEndISO: eventEnd.toISOString(),
                        eventStartLocal: eventStart.toString(),
                        eventEndLocal: eventEnd.toString(),
                        currentDate: this.current_date.toISOString(),
                        hoursDiff: hoursDiff,
                        crossesMidnight: eventStart.toDateString() !== eventEnd.toDateString()
                    };

                    if (isMultiDay) {
                        debugInfo.isStartDay = eventStart.toDateString() === this.current_date.toDateString();
                        debugInfo.isEndDay = eventEnd.toDateString() === this.current_date.toDateString();
                        console.log('Multi-day event detected:', debugInfo);
                    } else {
                        console.log('Single-day event detected:', debugInfo);
                    }
                }

                this.render_event(event, isMultiDay);
            });
        } catch (error) {
            console.error('Error rendering scheduled events:', error);

            // Show user-friendly error message 
            if (error.message && error.message.includes('Failed to fetch')) {
                this.show_message('Network connectivity issue. Please check your internet connection.', 'error');

                // Try to use cached data as fallback 
                const cachedEvents = this.storage_service.cache?.get('scheduled_events');
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

    /** * Render events from cached data when network is unavailable 
     */
    render_cached_events(cachedEvents) {
        try {
            // Filter cached events that should be visible on the current date 
            const visibleEvents = cachedEvents.filter(event => {
                if (event.start_time && event.end_time) {
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);
                    const currentDateStart = new Date(this.current_date);
                    currentDateStart.setHours(0, 0, 0, 0);
                    const currentDateEnd = new Date(this.current_date);
                    currentDateEnd.setHours(23, 59, 59, 999);

                    return Utils.datetime_ranges_overlap(eventStart, eventEnd, currentDateStart, currentDateEnd);
                }
                return false;
            });

            visibleEvents.forEach(event => {
                // Calculate isMultiDay for cached events with robust detection 
                let isMultiDay = false;
                if (event.start_time && event.end_time) {
                    const eventStart = new Date(event.start_time);
                    const eventEnd = new Date(event.end_time);

                    const eventDuration = eventEnd.getTime() - eventStart.getTime();
                    const hoursDiff = eventDuration / 3600000;

                    // Event is multi-day if it spans more than 24 hours OR crosses midnight 
                    isMultiDay = hoursDiff > 24 || eventStart.toDateString() !== eventEnd.toDateString();
                }
                this.render_event(event, isMultiDay);
            });

            console.log(`Rendered ${visibleEvents.length} events from cache`);
        } catch (error) {
            console.error('Error rendering cached events:', error);
        }
    }

    render_event(event, isMultiDay = false) {
        console.log(`Rendering event: ${event.taskTitle} (${event.id}) on machine: ${event.machine}`);
        
        // Debug: Show available machine IDs and names in the calendar
        const availableMachines = Array.from(this.elements.calendar_container.querySelectorAll('[data-machine]')).map(row => ({
            id: row.dataset.machine,
            name: row.dataset.machineName || 'Unknown'
        }));
        // console.log(`Available machines in calendar:`, availableMachines);
        
        // Find machine row by machine ID (preferred) or by name (fallback)
        let machineRow = this.elements.calendar_container.querySelector(`[data-machine="${event.machineId}"]`);
        if (!machineRow) {
            // Fallback to machine name if ID not found
            machineRow = this.elements.calendar_container.querySelector(`[data-machine="${event.machine}"]`);
        }
        
        if (!machineRow) {
            console.warn(`Machine row not found for ${event.machine} (ID: ${event.machineId}). Available machines:`, availableMachines);
            return;
        }

        const slots = machineRow.querySelector('.machine-slots');
        if (!slots) {
            console.warn(`Machine slots not found for ${event.machine}`);
            return;
        }

        const eventElement = document.createElement('div');
        eventElement.className = 'scheduled-event';
        eventElement.dataset.eventId = event.id;
        eventElement.dataset.taskId = event.taskId;
        eventElement.style.background = event.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

        // Calculate positioning based on new datetime structure 
        let startHour, endHour;

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
            const currentDateStart = new Date(this.current_date);
            currentDateStart.setHours(0, 0, 0, 0);
            const currentDateEnd = new Date(this.current_date);
            currentDateEnd.setHours(23, 59, 59, 999);

            const totalEventDays = Math.ceil((eventEnd - eventStart) / (1000 * 60 * 60 * 24));

            if (isMultiDay && eventStart.toDateString() === this.current_date.toDateString()) {
                // Start of a multi-day event
                startHour = eventStart.getHours();
                endHour = 24;
                eventElement.classList.add('multi-day-start');
                eventElement.title = this.generate_enhanced_tooltip(event, 'start', totalEventDays);
            } else if (isMultiDay && eventEnd.toDateString() === this.current_date.toDateString()) {
                // End of a multi-day event
                startHour = 0;
                endHour = eventEnd.getHours();
                if (endHour === 0 && eventEnd.getMinutes() === 0) return; // Don't render 0-length event on this day
                eventElement.classList.add('multi-day-end');
                eventElement.title = this.generate_enhanced_tooltip(event, 'end', totalEventDays);
            } else if (isMultiDay && eventStart < this.current_date && eventEnd > this.current_date) {
                // Middle of a multi-day event
                startHour = 0;
                endHour = 24;
                eventElement.classList.add('multi-day-middle');
                const daysFromStart = Math.floor((this.current_date - eventStart) / (1000 * 60 * 60 * 24));
                eventElement.title = this.generate_enhanced_tooltip(event, 'middle', totalEventDays, daysFromStart + 1);
            } else {
                // Single-day event
                startHour = eventStart.getHours();
                endHour = eventEnd.getHours();
            }
        }

        // Calculate precise positioning using 15-minute slots 
        const totalSlots = 96; // 24 hours * 4 slots/hr
        let startMinutes, endMinutes;

        if (isMultiDay && eventStart.toDateString() === this.current_date.toDateString()) {
            startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
            endMinutes = 24 * 60;
        } else if (isMultiDay && eventEnd.toDateString() === this.current_date.toDateString()) {
            startMinutes = 0;
            endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
        } else if (isMultiDay) {
            startMinutes = 0;
            endMinutes = 24 * 60;
        } else {
            startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
            endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
        }

        const startSlot = Math.floor(startMinutes / 15);
        const endSlot = Math.ceil(endMinutes / 15);
        const durationSlots = endSlot - startSlot;

        const leftPosition = (startSlot / totalSlots) * 100;
        const width = (durationSlots / totalSlots) * 100;

        // Debug logging for positioning calculations 
        if (event.taskTitle && event.taskTitle.includes('P000025')) {
            console.log('Positioning calculation for P000025:', {
                startHour,
                endHour,
                startMinutes,
                endMinutes,
                startSlot,
                endSlot,
                durationSlots,
                leftPosition,
                width,
                currentDate: this.current_date.toDateString(),
                eventStart: eventStart.toDateString(),
                eventEnd: eventEnd.toDateString(),
                isMultiDay,
                dayType: isMultiDay ? (eventStart.toDateString() === this.current_date.toDateString() ? 'start' : eventEnd.toDateString() === this.current_date.toDateString() ? 'end' : 'middle') : 'single',
                totalEventDays: Math.ceil((eventEnd - eventStart) / (1000 * 60 * 60 * 24))
            });
        }
        
        // Debug logging for all events to see what's happening
        console.log(`Event ${event.taskTitle} positioning:`, {
            startHour,
            endHour,
            startMinutes,
            endMinutes,
            startSlot,
            endSlot,
            durationSlots,
            leftPosition,
            width,
            currentDate: this.current_date.toDateString(),
            eventStart: eventStart.toDateString(),
            eventEnd: eventEnd.toDateString(),
            isMultiDay
        });

        eventElement.style.position = 'absolute';
        eventElement.style.left = `${leftPosition}%`;
        eventElement.style.width = `${width}%`;
        eventElement.style.height = '90%';
        eventElement.style.top = '5%';
        eventElement.textContent = event.taskTitle;
        eventElement.draggable = true;

        // Make event draggable
        eventElement.addEventListener('dragstart', (e) => {
            this.drag_state.is_dragging = true;
            this.drag_state.dragged_element = eventElement;
            this.drag_state.drag_type = 'event';

            eventElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', event.id);
            e.dataTransfer.effectAllowed = 'move';
        });

        eventElement.addEventListener('dragend', (e) => {
            this.drag_state.is_dragging = false;
            this.drag_state.dragged_element = null;
            this.drag_state.drag_type = null;
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
        this.current_date = new Date();
        this.current_date.setHours(0, 0, 0, 0);
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
        this.current_date.setDate(this.current_date.getDate() - 1);
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
        this.current_date.setDate(this.current_date.getDate() + 1);
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
            const isToday = this.current_date.toDateString() === new Date().toDateString();
            this.elements.current_date.textContent = isToday
                ? 'Today'
                : this.current_date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        }
    }

    async refresh_scheduler() {
        await this.load_tasks();
        await this.render_calendar();
    }

    /** * Generate enhanced tooltip with task information 
     */
    generate_enhanced_tooltip(event, dayType, totalDays, currentDay = null) {
        const totalDuration = event.duration || this.calculate_event_duration(event);
        // In the consolidated approach, cost and progress come from the ODP order 
        const cost = event.cost || 'N/A';
        const progress = event.progress || 'N/A';

        let tooltip = `${event.taskTitle}\n`;
        tooltip += `Total Duration: ${totalDuration}h\n`;
        tooltip += `Cost: ${cost}\n`;
        tooltip += `Progress: ${progress}`;

        // Add day-specific information for multi-day events 
        if (dayType === 'start') {
            tooltip += `\n(Multi-day event starting today - continues for ${totalDays} days)`;
        } else if (dayType === 'end') {
            tooltip += `\n(Multi-day event ending today - started ${totalDays} days ago)`;
        } else if (dayType === 'middle' && currentDay) {
            tooltip += `\n(Multi-day event - day ${currentDay} of ${totalDays})`;
        }

        return tooltip;
    }

    /** * Calculate event duration from start and end times 
     */
    calculate_event_duration(event) {
        if (event.start_time && event.end_time) {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);
            const durationHours = (end - start) / 3600000;
            return Math.round(durationHours * 100) / 100;
        }
        return event.duration || 0;
    }
}

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