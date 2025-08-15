/** * Production Scheduler - Optimized and Verified Implementation
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
    }

    init() {
        if (!this._bind_elements()) {
            console.error('Scheduler initialization failed: Required DOM elements not found');
            return false;
        }

        this._attach_event_listeners();
        this.update_date_display();

        // Load initial data without blocking UI
        this.refresh_scheduler().catch(error => console.error('Initial scheduler refresh failed:', error));

        return true;
    }

    _bind_elements() {
        const elementIds = ['task_pool', 'calendar_container', 'current_date', 'today_btn', 'prev_day', 'next_day', 'message_container'];
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });

        const missingKeys = Object.keys(this.elements).filter(key => !this.elements[key]);
        if (missingKeys.length > 0) {
            console.error('Missing required elements:', missingKeys);
            return false;
        }
        return true;
    }

    _attach_event_listeners() {
        this.elements.today_btn.addEventListener('click', () => this.go_to_today());
        this.elements.prev_day.addEventListener('click', () => this.previous_day());
        this.elements.next_day.addEventListener('click', () => this.next_day());
        this._setup_task_pool_drop_zone();

        window.addEventListener('machineAvailabilityChanged', () => this.render_calendar());
        window.addEventListener('dataChange', (e) => this._handle_data_change(e.detail));
    }

    _handle_data_change({ dataType }) {
        if (dataType === 'machines' || dataType === 'tasks') {
            this.refresh_scheduler().catch(error => console.error('Error refreshing scheduler from data change event:', error));
        }
    }

    // Consolidated navigation logic
    _updateDateAndRender(dateUpdater) {
        dateUpdater();
        this.update_date_display();
        this.render_calendar().catch(error => console.error('Error rendering calendar:', error));
    }

    go_to_today() {
        this._updateDateAndRender(() => {
            this.current_date = new Date();
            this.current_date.setHours(0, 0, 0, 0);
        });
    }

    previous_day() {
        this._updateDateAndRender(() => this.current_date.setDate(this.current_date.getDate() - 1));
    }

    next_day() {
        this._updateDateAndRender(() => this.current_date.setDate(this.current_date.getDate() + 1));
    }

    update_date_display() {
        if (!this.elements.current_date) return;
        const isToday = this.current_date.toDateString() === new Date().toDateString();
        this.elements.current_date.textContent = isToday ?
            'Today' :
            this.current_date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }

    async refresh_scheduler() {
        await this.load_tasks();
        await this.render_calendar();
    }

    async refresh_machine_data() {
        try {
            this.storage_service.clear_cache('machines');
            await this.render_calendar();
            console.log('Machine data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing machine data:', error);
        }
    }

    async load_tasks() {
        const taskPool = this.elements.task_pool;
        taskPool.innerHTML = ''; // Clear previous tasks

        try {
            const allOrders = await this.storage_service.get_odp_orders();
            const availableTasks = allOrders.filter(order => order.status !== 'SCHEDULED');

            if (availableTasks.length === 0) {
                taskPool.innerHTML = '<div class="empty-state">No tasks available for scheduling</div>';
                return;
            }

            availableTasks.forEach(task => this._create_task_element(task));
        } catch (error) {
            console.error('Error loading tasks:', error);
            taskPool.innerHTML = '<div class="empty-state">Error loading tasks</div>';
        }
    }

    async render_calendar() {
        const calendarContainer = this.elements.calendar_container;
        calendarContainer.innerHTML = ''; // Clear previous view

        try {
            const allMachines = await this.storage_service.get_machines();
            const activeMachines = allMachines.filter(m => (m.status ? m.status.toUpperCase() === 'ACTIVE' : !!m.machine_name));

            if (activeMachines.length === 0) {
                calendarContainer.innerHTML = '<div class="empty-state">No active machines available for scheduling</div>';
                return;
            }

            this._create_calendar_header(calendarContainer);
            activeMachines.forEach(machine => this._create_machine_row(machine, calendarContainer));
            await this.render_scheduled_events();
        } catch (error) {
            console.error('Error rendering calendar:', error);
            calendarContainer.innerHTML = '<div class="empty-state">Error loading calendar</div>';
        }
    }

    async render_scheduled_events() {
        this.elements.calendar_container.querySelectorAll('.scheduled-event').forEach(el => el.remove());

        try {
            const allEvents = await this.storage_service.get_scheduled_events();
            if (!allEvents || allEvents.length === 0) {
                console.log('No scheduled events found.');
                return;
            }

            const visibleEvents = allEvents.filter(event => this._is_event_visible(event));
            visibleEvents.forEach(event => this._render_event(event));

        } catch (error) {
            console.error('Error rendering scheduled events:', error);
            this.show_message('Error loading scheduled events', 'error');
        }
    }

    async schedule_task(taskId, taskData, slot) {
        const machineId = slot.dataset.machine;
        const hour = parseInt(slot.dataset.hour);
        const minute = parseInt(slot.dataset.minute) || 0;
        const duration = this.get_task_duration(taskData);

        const startDate = new Date(this.current_date);
        startDate.setHours(hour, minute, 0, 0);
        const endDate = new Date(startDate.getTime() + (duration * 3600000));

        try {
            const machines = await this.storage_service.get_machines();
            const targetMachine = machines.find(m => m.id === machineId);

            if (!targetMachine || targetMachine.work_center !== taskData.work_center) {
                this.show_message(`Task can only be scheduled on machines with work center: ${taskData.work_center}`, 'error');
                return;
            }

            if (!(await this._can_schedule_at(machineId, startDate, endDate))) {
                this.show_message('Cannot schedule task at this time due to a conflict.', 'error');
                return;
            }

            const event = {
                id: `event_${taskId}_${machineId}`,
                taskId,
                taskTitle: taskData.odp_number || 'Unknown Task',
                machine: machineId,
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                color: this.get_task_color(taskData),
            };

            await this.storage_service.add_scheduled_event(event);
            window.dispatchEvent(new CustomEvent('odpStatusChanged', { detail: { odpId: taskId, status: 'SCHEDULED' } }));
            this.show_message(`Task scheduled successfully on ${targetMachine.machine_name}`, 'success');

            setTimeout(() => this.refresh_scheduler(), 300); // Allow DB time to sync
        } catch (error) {
            console.error('Error scheduling task:', error);
            this.show_message('Failed to schedule task', 'error');
        }
    }

    async reschedule_event(eventId, newSlot) {
        const newMachineId = newSlot.dataset.machine;
        const newHour = parseInt(newSlot.dataset.hour);
        const newMinute = parseInt(newSlot.dataset.minute) || 0;

        try {
            const [existingEvent, allOrders, machines] = await Promise.all([
                this.storage_service.get_scheduled_event_by_id(eventId),
                this.storage_service.get_odp_orders(),
                this.storage_service.get_machines()
            ]);

            if (!existingEvent) return this.show_message('Event not found', 'error');

            const taskData = allOrders.find(order => order.id === existingEvent.taskId);
            const newMachine = machines.find(m => m.id === newMachineId);

            if (!newMachine || (taskData && newMachine.work_center !== taskData.work_center)) {
                return this.show_message(`Task can only be moved to a machine in work center: ${taskData?.work_center}`, 'error');
            }

            const duration = this.calculate_event_duration(existingEvent) || 1;
            const newStartDate = new Date(this.current_date);
            newStartDate.setHours(newHour, newMinute, 0, 0);
            const newEndDate = new Date(newStartDate.getTime() + (duration * 3600000));

            if (!(await this._can_schedule_at(newMachineId, newStartDate, newEndDate, eventId))) {
                return this.show_message('Cannot reschedule to this time slot due to a conflict.', 'error');
            }

            const newEvent = {
                ...existingEvent,
                id: `event_${existingEvent.taskId}_${newMachineId}`,
                machine: newMachineId,
                start_time: newStartDate.toISOString(),
                end_time: newEndDate.toISOString(),
            };

            await this.storage_service.add_scheduled_event(newEvent);
            this.show_message(`Task rescheduled successfully to ${newMachine.machine_name}`, 'success');
            await this.refresh_scheduler();

        } catch (error) {
            console.error('Error rescheduling event:', error);
            this.show_message('Failed to reschedule task', 'error');
        }
    }

    async unschedule_event(eventId) {
        try {
            const event = await this.storage_service.get_scheduled_event_by_id(eventId);
            await this.storage_service.remove_scheduled_event(eventId);

            if (event?.taskId) {
                window.dispatchEvent(new CustomEvent('odpStatusChanged', { detail: { odpId: event.taskId, status: 'NOT SCHEDULED' } }));
            }
            this.show_message('Task unscheduled successfully', 'success');
            await this.refresh_scheduler();
        } catch (error) {
            console.error('Error unscheduling event:', error);
            this.show_message('Failed to unschedule task', 'error');
        }
    }

    async _can_schedule_at(machineId, start, end, excludeEventId = null) {
        const allEvents = await this.storage_service.get_scheduled_events();
        return !allEvents.some(event =>
            (event.machineId === machineId || event.machine === machineId) &&
            event.id !== excludeEventId &&
            Utils.datetime_ranges_overlap(start, end, new Date(event.start_time), new Date(event.end_time))
        );
    }

    // DOM Creation and Rendering Helpers
    _createElement(tag, { className, dataset = {}, textContent = '' } = {}) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        Object.entries(dataset).forEach(([key, value]) => el.dataset[key] = value);
        if (textContent) el.textContent = textContent;
        return el;
    }

    _create_task_element(task) {
        const duration = this.get_task_duration(task);
        const taskElement = this._createElement('div', {
            className: 'task-item',
            dataset: { taskId: task.id }
        });
        taskElement.draggable = true;
        taskElement.style.background = this.get_task_color(task);
        taskElement.innerHTML = `<span>${task.odp_number || 'Unknown Task'}</span><span class="task-duration">${duration}h</span>`;

        taskElement.addEventListener('dragstart', (e) => this._on_drag_start(e, taskElement, 'task', task));
        taskElement.addEventListener('dragend', () => this._on_drag_end(taskElement));

        this.elements.task_pool.appendChild(taskElement);
    }

    _create_calendar_header(container) {
        const headerRow = this._createElement('div', { className: 'calendar-header-row' });
        headerRow.appendChild(this._createElement('div', { className: 'machine-label-header', textContent: 'Machines' }));
        const timeHeader = this._createElement('div', { className: 'time-header' });
        for (let slot = 0; slot < 96; slot++) {
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
        for (let slotIdx = 0; slotIdx < 96; slotIdx++) {
            const hour = Math.floor(slotIdx / 4);
            const minute = (slotIdx % 4) * 15;
            const slot = this._createElement('div', {
                className: 'time-slot',
                dataset: { hour, minute, slot: slotIdx, machine: machine.id, machineName: displayName }
            });
            this._setup_slot_drop_zone(slot);
            machineSlots.appendChild(slot);
        }
        machineRow.appendChild(machineSlots);
        container.appendChild(machineRow);
    }

    _render_event(event) {
        const machineRow = this.elements.calendar_container.querySelector(`[data-machine="${event.machineId || event.machine}"]`);
        if (!machineRow) {
            console.warn(`Machine row not found for event:`, event);
            return;
        }

        const position = this._calculate_event_position(event);
        if (!position) return; // Event is not visible today

        const eventElement = this._createElement('div', {
            className: 'scheduled-event',
            dataset: { eventId: event.id, taskId: event.taskId },
            textContent: event.taskTitle
        });
        eventElement.style.background = event.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        eventElement.style.left = `${position.left}%`;
        eventElement.style.width = `${position.width}%`;
        eventElement.draggable = true;

        eventElement.addEventListener('dragstart', (e) => this._on_drag_start(e, eventElement, 'event'));
        eventElement.addEventListener('dragend', () => this._on_drag_end(eventElement));

        machineRow.querySelector('.machine-slots')?.appendChild(eventElement);
    }

    // Drag and Drop Logic
    _on_drag_start(e, element, type, data = null) {
        this.drag_state.is_dragging = true;
        this.drag_state.dragged_element = element;
        this.drag_state.drag_type = type;
        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';

        if (type === 'task' && data) {
            e.dataTransfer.setData('text/plain', data.id);
            e.dataTransfer.setData('application/json', JSON.stringify(data));
        } else {
            e.dataTransfer.setData('text/plain', element.dataset.eventId);
        }
    }

    _on_drag_end(element) {
        this.drag_state.is_dragging = false;
        this.drag_state.dragged_element = null;
        this.drag_state.drag_type = null;
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
            if (!taskPool.contains(e.relatedTarget)) {
                taskPool.classList.remove('drag-over');
            }
        });
        taskPool.addEventListener('drop', (e) => {
            e.preventDefault();
            taskPool.classList.remove('drag-over');
            if (this.drag_state.drag_type === 'event') {
                const eventId = e.dataTransfer.getData('text/plain');
                this.unschedule_event(eventId);
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
            const data = e.dataTransfer.getData('text/plain');
            if (this.drag_state.drag_type === 'task') {
                const taskData = JSON.parse(e.dataTransfer.getData('application/json'));
                this.schedule_task(data, taskData, slot);
            } else if (this.drag_state.drag_type === 'event') {
                this.reschedule_event(data, slot);
            }
        });
    }

    // Calculation and Utility Helpers
    _is_event_visible(event) {
        if (!event.start_time || !event.end_time) return false;
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        const dayStart = new Date(this.current_date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(this.current_date);
        dayEnd.setHours(23, 59, 59, 999);
        return Utils.datetime_ranges_overlap(eventStart, eventEnd, dayStart, dayEnd);
    }

    _calculate_event_position(event) {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return null;

        const dayStart = new Date(this.current_date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(this.current_date);
        dayEnd.setHours(23, 59, 59, 999);

        // **THE FIX:** Use the numeric timestamps for comparison, but keep the Date objects
        const visibleStart = eventStart.getTime() > dayStart.getTime() ? eventStart : dayStart;
        const visibleEnd = eventEnd.getTime() < dayEnd.getTime() ? eventEnd : dayEnd;

        const totalMinutesInDay = 24 * 60;
        const startMinute = (visibleStart.getHours() * 60) + visibleStart.getMinutes();
        const endMinute = (visibleEnd.getHours() * 60) + visibleEnd.getMinutes();

        // Ensure width is not negative if an event ends at midnight
        if (endMinute === 0 && visibleEnd > visibleStart) {
             const left = (startMinute / totalMinutesInDay) * 100;
             const width = ((totalMinutesInDay - startMinute) / totalMinutesInDay) * 100;
             return { left, width };
        }

        const left = (startMinute / totalMinutesInDay) * 100;
        const width = ((endMinute - startMinute) / totalMinutesInDay) * 100;

        return { left, width };
    }

    get_task_color(task) {
        return task.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    get_task_duration(task) {
        const duration = parseFloat(task.duration) || 1;
        return Math.max(0.1, Math.round(duration * 10) / 10);
    }

    calculate_event_duration(event) {
        if (event.start_time && event.end_time) {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);
            return Math.round(((end - start) / 3600000) * 100) / 100;
        }
        return event.duration || 0;
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