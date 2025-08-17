/**
 * Production Scheduler - Now uses unified CalendarRenderer
 * Optimized for performance and maintainability.
 */
import { BusinessLogicService } from './businessLogicService.js';
import { Utils } from './utils.js';
import { appStore } from './store.js'; // Import the store
import { CalendarRenderer } from './calendarRenderer.js'; // Import unified calendar renderer

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

        // Calendar renderer for unified calendar functionality
        this.calendarRenderer = null;

        // Debounce availability refresh
        this.availability_refresh_timeout = null;
        this._availability_load_timeout = null;
    }

    init() {
        if (!this._bind_elements()) {
            console.error('Scheduler initialization failed: Required DOM elements not found');
            return false;
        }

        this._setup_calendar_renderer();
        this._attach_event_listeners();
        this.update_date_display();

        // Subscribe to store changes for re-rendering
        appStore.subscribe(() => this.render());
        this.render(); // Initial render

        // Expose debug methods globally for testing
        window.schedulerDebug = {
            setDate: (dateStr) => this.set_current_date(dateStr),
            debugAvailability: () => this.debug_availability(),
            goToAugust13: () => this.set_current_date('2025-08-13'),
            showCurrentDate: () => this.current_date,
            checkTableStatus: () => appStore.getMachineAvailabilityStatus(),
        };

        return true;
    }

    async render() {
        const { odpOrders, machines, isLoading, machineAvailability } = appStore.getState();
        this.currentMachineAvailability = machineAvailability;
        this.currentMachines = machines;
        this.currentOdpOrders = odpOrders;

        if (isLoading) {
            this.elements.task_pool.innerHTML = '<div class="empty-state">Loading...</div>';
            this.elements.calendar_container.innerHTML = '<div class="empty-state">Loading...</div>';
            return;
        }

        const currentDateStr = this._get_date_string();
        if (!machineAvailability[currentDateStr]) {
            await this._load_machine_availability_for_date();
        }

        // --- FIX START: Ensure header is rendered ---
        if (!this.elements.calendar_container.querySelector('.calendar-header-row')) {
            this.elements.calendar_container.innerHTML = ''; // Clear previous state
            this._create_calendar_header(this.elements.calendar_container);
            const machineContainer = this._createElement('div', { className: 'machine-rows-container' });
            this.elements.calendar_container.appendChild(machineContainer);
            this.elements.machine_container = machineContainer;
        }
        // --- FIX END ---

        const unscheduledTasks = odpOrders.filter(order => order.status !== 'SCHEDULED');
        const activeMachines = machines.filter(m => m.status === 'ACTIVE');

        this._render_diff(this.elements.task_pool, unscheduledTasks, (task) => `task-${task.id}`, (task) => this._create_task_element(task));
        this._render_diff(this.elements.machine_container, activeMachines, (machine) => `machine-row-${machine.id}`, (machine) => this._create_machine_row(machine, odpOrders, machineAvailability, machines));
    }

    _render_diff(container, data, keyFn, renderFn) {
        if (!container) return;

        const existingElements = new Map();
        for (const child of container.children) {
            existingElements.set(child.dataset.key, child);
        }

        const newKeys = new Set();
        data.forEach((item, index) => {
            const key = keyFn(item);
            newKeys.add(key);

            const newItemElement = renderFn(item);
            newItemElement.dataset.key = key;

            const existingElement = existingElements.get(key);
            if (existingElement) {
                if (existingElement.innerHTML !== newItemElement.innerHTML) {
                    container.replaceChild(newItemElement, existingElement);
                }
            } else {
                const nextItem = data[index + 1];
                const nextKey = nextItem ? keyFn(nextItem) : null;
                const nextElement = nextKey ? existingElements.get(nextKey) : null;
                container.insertBefore(newItemElement, nextElement);
            }
        });

        for (const [key, element] of existingElements.entries()) {
            if (!newKeys.has(key)) {
                container.removeChild(element);
            }
        }
    }

    _bind_elements() {
        const elementIds = ['task_pool', 'calendar_container', 'current_date', 'today_btn', 'prev_day', 'next_day', 'message_container'];
        elementIds.forEach(id => this.elements[id] = document.getElementById(id));
        return elementIds.every(id => this.elements[id]);
    }

    /**
     * Setup the unified calendar renderer
     */
    _setup_calendar_renderer() {
        const activeMachines = this.currentMachines?.filter(m => m.status === 'ACTIVE') || [];
        
        const calendarConfig = {
            mode: 'scheduler',
            views: ['week'], // Scheduler only needs week view
            machines: activeMachines,
            showMachines: true,
            interactive: true,
            enableDragDrop: true,
            startHour: 0,
            endHour: 24,
            onSlotClick: this._handle_slot_click.bind(this),
            onSlotDrop: this._handle_task_drop.bind(this),
            onSlotHover: this._handle_slot_hover.bind(this)
        };
        
        this.calendarRenderer = new CalendarRenderer(this.elements.calendar_container, calendarConfig);
        this.calendarRenderer.init();
        
        console.log('🔧 [Scheduler] Calendar renderer initialized in scheduler mode');
    }

    _attach_event_listeners() {
        this.elements.today_btn.addEventListener('click', () => this._navigate_date('today'));
        this.elements.prev_day.addEventListener('click', () => this._navigate_date('prev'));
        this.elements.next_day.addEventListener('click', () => this._navigate_date('next'));
        this._setup_task_pool_drop_zone();
    }

    _mapOdpToEvents(scheduledOdps, machines) {
        const machineMap = new Map(machines.map(m => [m.id, m.machine_name]));
        return scheduledOdps.map(odp => ({
            id: `event_${odp.id}`,
            taskId: odp.id,
            taskTitle: odp.odp_number,
            machine: machineMap.get(odp.scheduled_machine_id) || 'Unknown',
            machineId: odp.scheduled_machine_id,
            start_time: odp.scheduled_start_time,
            end_time: odp.scheduled_end_time,
            color: odp.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }));
    }

    set_current_date(dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            this.current_date = date;
            this.current_date.setHours(0, 0, 0, 0);
            this._navigate_date();
        }
    }

    _navigate_date(direction) {
        const newDate = new Date(this.current_date);
        if (direction === 'today') {
            this.current_date = new Date();
        } else if (direction === 'prev') {
            newDate.setDate(newDate.getDate() - 1);
            this.current_date = newDate;
        } else if (direction === 'next') {
            newDate.setDate(newDate.getDate() + 1);
            this.current_date = newDate;
        }
        this.current_date.setHours(0, 0, 0, 0);
        // Clear the calendar to force a full redraw including the header on date change
        this.elements.calendar_container.innerHTML = '';
        this.update_date_display();
        this.render();
    }

    update_date_display() {
        if (!this.elements.current_date) return;
        const isToday = this.current_date.toDateString() === new Date().toDateString();
        this.elements.current_date.textContent = isToday ? 'Today' : this.current_date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }

    _validate_slot_for_scheduling(taskData, machineData, slot, machineAvailability) {
        const taskWorkCenter = this.business_logic.auto_determine_work_center(taskData.article_code);
        if (taskWorkCenter !== machineData.work_center) {
            this.show_message(`Task work center (${taskWorkCenter}) does not match machine's (${machineData.work_center})`, 'error');
            return false;
        }

        if (slot.dataset.unavailable === 'true') {
            this.show_message('Cannot schedule: This time slot is marked as unavailable', 'error');
            return false;
        }

        const duration = parseFloat(taskData.time_remaining) || parseFloat(taskData.duration) || 1;
        const startHour = parseInt(slot.dataset.hour);
        for (let i = 0; i < Math.ceil(duration); i++) {
            if (this._is_slot_unavailable(machineData.machine_name, startHour + i, machineAvailability)) {
                this.show_message('Cannot schedule: Task overlaps with an unavailable time slot', 'error');
                return false;
            }
        }
        return true;
    }

    async schedule_task(taskId, taskData, slot) {
        const machineData = this.currentMachines?.find(m => m.id === slot.dataset.machine);
        if (!machineData || !this._validate_slot_for_scheduling(taskData, machineData, slot, this.currentMachineAvailability)) return;

        const hour = parseInt(slot.dataset.hour);
        const minute = parseInt(slot.dataset.minute) || 0;
        const duration = parseFloat(taskData.time_remaining) || parseFloat(taskData.duration) || 1;
        const startDate = new Date(this.current_date);
        startDate.setHours(hour, minute, 0, 0);
        const endDate = new Date(startDate.getTime() + (duration * 3600000));

        const event = {
            machine: machineData.id,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            color: taskData.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        };

        try {
            await appStore.scheduleTask(taskId, event);
            this.show_message('Task scheduled successfully', 'success');
        } catch (error) {
            this.show_message(`Failed to schedule task: ${error.message}`, 'error');
        }
    }

    async unschedule_event(taskId) {
        try {
            await appStore.unscheduleTask(taskId);
            this.show_message('Task unscheduled successfully', 'success');
        } catch (error) {
            this.show_message(`Failed to unschedule task: ${error.message}`, 'error');
        }
    }

    async reschedule_event(taskId, newSlot) {
        const taskData = this.currentOdpOrders?.find(o => o.id === taskId);
        if (taskData) {
            await this.schedule_task(taskId, taskData, newSlot);
        }
    }

    _createElement(tag, { className, dataset = {}, textContent = '' } = {}) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        Object.assign(el.dataset, dataset);
        if (textContent) el.textContent = textContent;
        return el;
    }
    
    _create_task_element(task) {
        const duration = parseFloat(task.time_remaining) || parseFloat(task.duration) || 1;
        const taskElement = this._createElement('div', { className: 'task-item', dataset: { taskId: task.id }});
        taskElement.draggable = true;
        taskElement.style.background = task.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        
        const workCenterInfo = task.work_center ? ` (${task.work_center})` : '';
        taskElement.innerHTML = `<span>${task.odp_number || 'Unknown Task'}${workCenterInfo}</span><span class="task-duration">${duration}h</span>`;
        if (task.work_center) {
            taskElement.title = `Work Center: ${task.work_center}`;
        }
        
        taskElement.addEventListener('dragstart', (e) => this._start_drag(e, taskElement, 'task', task));
        taskElement.addEventListener('dragend', () => this._end_drag(taskElement));
        return taskElement;
    }
    
    // --- [RESTORED] Method to create the calendar header ---
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

    _create_machine_row(machine, odpOrders, machineAvailability, machines) {
        const allScheduledEvents = this._mapOdpToEvents(odpOrders.filter(order => order.status === 'SCHEDULED'), machines);

        const machineRow = this._createElement('div', { className: 'machine-row', dataset: { machine: machine.id, machineName: machine.machine_name } });
        const machineLabel = this._createElement('div', { className: 'machine-label' });
        machineLabel.innerHTML = `<div class="machine-name">${machine.machine_name}</div><div class="machine-city">${machine.work_center || ''}</div>`;
        machineRow.appendChild(machineLabel);

        const machineSlots = this._createElement('div', { className: 'machine-slots' });
        for (let slotIdx = 0; slotIdx < 96; slotIdx++) {
            const hour = Math.floor(slotIdx / 4);
            const isUnavailable = this._is_slot_unavailable(machine.machine_name, hour, machineAvailability);
            const slot = this._createElement('div', {
                className: `time-slot ${isUnavailable ? 'unavailable' : ''}`,
                dataset: { hour, minute: (slotIdx % 4) * 15, machine: machine.id, machineName: machine.machine_name, workCenter: machine.work_center, unavailable: isUnavailable }
            });
            if (isUnavailable) {
                slot.innerHTML = '<span class="unavailable-indicator">X</span>';
                slot.title = `Machine unavailable from ${hour}:00 to ${hour + 1}:00`;
            }
            this._setup_slot_drop_zone(slot, machines);
            machineSlots.appendChild(slot);
        }
        
        allScheduledEvents
            .filter(event => event.machineId === machine.id && this._is_event_visible(event))
            .forEach(event => {
                const position = this._calculate_event_position(event);
                if (!position || position.width <= 0) return;
                const eventElement = this._createElement('div', {
                    className: 'scheduled-event',
                    dataset: { eventId: event.id, taskId: event.taskId },
                    textContent: event.taskTitle
                });
                Object.assign(eventElement.style, { background: event.color, left: `${position.left}%`, width: `${position.width}%` });
                eventElement.draggable = true;
                eventElement.addEventListener('dragstart', (e) => this._start_drag(e, eventElement, 'event', event));
                eventElement.addEventListener('dragend', () => this._end_drag(eventElement));
                machineSlots.appendChild(eventElement);
            });

        machineRow.appendChild(machineSlots);
        return machineRow;
    }
    
    _start_drag(e, element, type, data) {
        this.drag_state = { is_dragging: true, dragged_element: element, drag_type: type, dragged_data: data };
        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', data.id || element.dataset.taskId);
    }

    _end_drag(element) {
        this.drag_state = { is_dragging: false, dragged_element: null, drag_type: null, dragged_data: null };
        element.classList.remove('dragging');
        document.querySelectorAll('.drag-over, .drag-compatible, .drag-incompatible').forEach(el => {
            el.classList.remove('drag-over', 'drag-compatible', 'drag-incompatible');
        });
    }

    _setup_task_pool_drop_zone() {
        const taskPool = this.elements.task_pool;
        taskPool.addEventListener('dragover', e => {
            e.preventDefault();
            if (this.drag_state.drag_type === 'event') {
                e.dataTransfer.dropEffect = 'move';
                taskPool.classList.add('drag-over');
            }
        });
        taskPool.addEventListener('dragleave', () => taskPool.classList.remove('drag-over'));
        taskPool.addEventListener('drop', e => {
            e.preventDefault();
            taskPool.classList.remove('drag-over');
            if (this.drag_state.drag_type === 'event') {
                this.unschedule_event(this.drag_state.dragged_data.taskId);
            }
        });
    }

    _setup_slot_drop_zone(slot, machines) {
        slot.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            slot.classList.add('drag-over');

            if (this.drag_state.drag_type === 'task') {
                const machineData = machines.find(m => m.id === slot.dataset.machine);
                if (machineData) {
                    const isCompatible = this.business_logic.auto_determine_work_center(this.drag_state.dragged_data.article_code) === machineData.work_center;
                    slot.classList.toggle('drag-compatible', isCompatible);
                    slot.classList.toggle('drag-incompatible', !isCompatible);
                }
            }
        });
        
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over', 'drag-compatible', 'drag-incompatible'));
        
        slot.addEventListener('drop', e => {
            e.preventDefault();
            slot.classList.remove('drag-over', 'drag-compatible', 'drag-incompatible');
            const taskId = e.dataTransfer.getData('text/plain');
            if (this.drag_state.drag_type === 'task') {
                this.schedule_task(taskId, this.drag_state.dragged_data, slot);
            } else if (this.drag_state.drag_type === 'event') {
                this.reschedule_event(this.drag_state.dragged_data.taskId, slot);
            }
        });
    }

    _is_event_visible(event) {
        const eventStart = new Date(event.start_time);
        const dayStart = new Date(this.current_date);
        dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        return eventStart >= dayStart && eventStart < dayEnd;
    }

    _get_date_string() {
        return Utils.format_date(this.current_date);
    }

    _is_slot_unavailable(machineName, hour, machineAvailability) {
        const dateData = machineAvailability[this._get_date_string()];
        const availabilityRow = dateData?.find(row => row.machine_name === machineName);
        return availabilityRow?.unavailable_hours.includes(hour) || false;
    }

    async _load_machine_availability_for_date() {
        const currentDate = this._get_date_string();
        if (this.currentMachineAvailability[currentDate]?._loading || Array.isArray(this.currentMachineAvailability[currentDate])) {
            return;
        }

        if (this._availability_load_timeout) clearTimeout(this._availability_load_timeout);
        
        this._availability_load_timeout = setTimeout(async () => {
            try {
                await appStore.loadMachineAvailabilityForDate(currentDate);
            } catch (error) {
                console.warn(`Could not load availability for ${currentDate}:`, error.message);
            }
        }, 100);
    }
    
    _calculate_event_position(event) {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return null;
        
        const totalMinutesInDay = 24 * 60;
        const startMinute = (eventStart.getHours() * 60) + eventStart.getMinutes();
        const endMinute = (eventEnd.getHours() * 60) + eventEnd.getMinutes() || totalMinutesInDay;
        
        const left = (startMinute / totalMinutesInDay) * 100;
        const width = ((endMinute - startMinute) / totalMinutesInDay) * 100;

        return { left, width };
    }

    show_message(message, type) {
        const messageEl = this.elements.message_container;
        if (!messageEl) return;
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        setTimeout(() => messageEl.style.display = 'none', 3000);
    }

    /**
     * Handle slot click events from the calendar renderer
     */
    _handle_slot_click(slotData) {
        console.log('🔍 [Scheduler] Slot clicked:', slotData);
        // Handle slot clicks if needed
    }

    /**
     * Handle task drop events from the calendar renderer
     */
    _handle_task_drop(dropData) {
        console.log('🔍 [Scheduler] Task dropped:', dropData);
        // Handle task drops if needed
    }

    /**
     * Handle slot hover events from the calendar renderer
     */
    _handle_slot_hover(hoverData) {
        console.log('🔍 [Scheduler] Slot hover:', hoverData);
        // Handle slot hover if needed
    }
}