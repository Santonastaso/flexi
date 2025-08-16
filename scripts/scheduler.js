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

        return true;
    }

    render() {
        const { odpOrders, machines, isLoading } = appStore.getState();
        if (isLoading) {
            this.elements.task_pool.innerHTML = '<div class="empty-state">Loading...</div>';
            this.elements.calendar_container.innerHTML = '<div class="empty-state">Loading...</div>';
            return;
        }
        
        const unscheduledTasks = odpOrders.filter(order => order.status !== 'SCHEDULED');
        const scheduledEvents = this._mapOdpToEvents(odpOrders.filter(order => order.status === 'SCHEDULED'));
        const activeMachines = machines.filter(m => m.status === 'ACTIVE');

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