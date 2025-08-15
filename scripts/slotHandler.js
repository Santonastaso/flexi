/**
 * Shared Slot Handler - Unified slot interaction logic
 * Handles click, hover, and drag/drop interactions for calendar slots
 */
class SlotHandler {
    constructor(options = {}) {
        this.options = {
            enable_drag_drop: options.enableDragDrop ?? true,
            enable_click: options.enableClick ?? true,
            enable_hover: options.enableHover ?? true,
            feedback_duration: options.feedbackDuration ?? 2000,
            on_slot_click: options.onSlotClick ?? null,
            on_slot_drop: options.onSlotDrop ?? null,
            on_slot_hover: options.onSlotHover ?? null,
            on_validation_error: options.onValidationError ?? null,
            on_success: options.onSuccess ?? null,
            ...options
        };

        this.storage_service = window.storageService;
        this.drag_state = {
            is_dragging: false,
            dragged_item: null,
            drag_start_time: null
        };
    }

    /**
     * Initialize slot interactions for a container
     */
    initialize_slots(container) {
        if (!container) return;

        container.querySelectorAll('.time-slot.interactive').forEach(slot => {
            this.setup_slot_interactions(slot);
        });

        const task_pool = container.querySelector('.task-pool-container, #taskPool');
        if (task_pool) {
            this.setup_task_pool_interactions(task_pool);
        }
    }

    /**
     * Setup interactions for a single slot
     */
    setup_slot_interactions(slot) {
        if (this.options.enable_click && this.options.on_slot_click) {
            slot.addEventListener('click', (e) => {
                e.preventDefault();
                this.handle_slot_click(slot, e);
            });
        }

        if (this.options.enable_hover) {
            ['mouseenter', 'mouseleave'].forEach(eventType => {
                slot.addEventListener(eventType, e => {
                    this.handle_slot_hover(slot, e, eventType === 'mouseenter' ? 'enter' : 'leave');
                });
            });
        }

        if (this.options.enable_drag_drop) {
            this.setup_drag_drop_for_slot(slot);
        }
    }

    /**
     * Setup drag and drop for a slot
     */
    setup_drag_drop_for_slot(slot) {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!slot.classList.contains('drag-over')) {
                slot.classList.add('drag-over');
                this.show_slot_feedback(slot, 'drag-over');
            }
        });

        slot.addEventListener('dragleave', (e) => {
            if (!slot.contains(e.relatedTarget)) {
                slot.classList.remove('drag-over');
                this.clear_slot_feedback(slot, 'drag-over');
            }
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            this.clear_slot_feedback(slot, 'drag-over');
            this.handle_slot_drop(slot, e);
        });
    }

    /**
     * Setup task pool interactions
     */
    setup_task_pool_interactions(task_pool) {
        if (!task_pool.classList.contains('task-pool-container')) {
            task_pool.classList.add('task-pool-container');
        }

        task_pool.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            task_pool.classList.add('drag-over');
        });

        task_pool.addEventListener('dragleave', (e) => {
            if (!task_pool.contains(e.relatedTarget)) {
                task_pool.classList.remove('drag-over');
            }
        });

        task_pool.addEventListener('drop', (e) => {
            e.preventDefault();
            task_pool.classList.remove('drag-over');
            this.handle_task_pool_drop(task_pool, e);
        });

        this.setup_task_dragging(task_pool);
    }

    /**
     * Setup dragging for tasks in the pool
     */
    setup_task_dragging(task_pool) {
        task_pool.querySelectorAll('.task-item').forEach(task => {
            task.draggable = true;
            task.addEventListener('dragstart', (e) => {
                this.drag_state.is_dragging = true;
                this.drag_state.dragged_item = task;
                this.drag_state.drag_start_time = Date.now();
                task.classList.add('dragging');
                const taskId = task.id.replace('pool-task-', '') || task.dataset.taskId;
                e.dataTransfer.setData('text/plain', taskId);
                e.dataTransfer.setData('application/json', JSON.stringify({ id: taskId, source: 'pool' }));
                e.dataTransfer.effectAllowed = 'move';
            });

            task.addEventListener('dragend', (e) => {
                this.drag_state.is_dragging = false;
                this.drag_state.dragged_item = null;
                task.classList.remove('dragging');
                this.clear_all_feedback();
            });
        });
    }

    /**
     * Handle slot click events
     */
    handle_slot_click(slot, event) {
        const slot_data = this.extract_slot_data(slot);
        if (this.options.on_slot_click) {
            this.options.on_slot_click(slot_data, event, slot);
        } else {
            this.toggle_slot_availability(slot_data, slot);
        }
    }

    /**
     * Handle slot hover events
     */
    handle_slot_hover(slot, event, action) {
        const slot_data = this.extract_slot_data(slot);
        if (action === 'enter') {
            this.show_slot_preview(slot, slot_data);
        } else {
            this.hide_slot_preview(slot, slot_data);
        }
        this.options.on_slot_hover?.(slot_data, event, slot, action);
    }

    /**
     * Handle slot drop events
     */
    handle_slot_drop(slot, event) {
        event.preventDefault();
        event.stopPropagation();

        const slot_data = this.extract_slot_data(slot);
        const task_id = event.dataTransfer.getData('text/plain');

        if (!task_id || !this.validate_slot_for_drop(slot_data, task_id)) {
            this.show_error('Invalid task data or slot.');
            return;
        }

        if (this.options.on_slot_drop) {
            this.options.on_slot_drop(slot_data, task_id, event, slot);
        } else {
            this.schedule_task_to_slot(slot_data, task_id, slot);
        }
    }

    /**
     * Handle task pool drop events
     */
    handle_task_pool_drop(task_pool, event) {
        const event_id = event.dataTransfer.getData('text/plain');
        if (!event_id) {
            this.show_error('Invalid event data');
            return;
        }
        let event_data;
        try {
            event_data = JSON.parse(event.dataTransfer.getData('application/json'));
        } catch (e) {
            event_data = { id: event_id };
        }
        if (event_data.source === 'pool') return; // Task already in pool
        this.unschedule_task(event_id, task_pool);
    }

    /**
     * Validate if a slot can accept a drop
     */
    validate_slot_for_drop(slot_data, task_id) {
        if (!this.storage_service) return !this.show_error('Storage service not available');
        if (this.is_slot_occupied(slot_data)) return !this.show_error('This time slot is already occupied');
        if (this.is_slot_unavailable(slot_data)) return !this.show_error('This time slot is marked as unavailable');

        const task = this.storage_service.getBacklogTaskById(task_id);
        if (!task) return !this.show_error('Task not found');
        if (!this.validate_task_duration(slot_data, task)) {
            return !this.show_error(`Task duration (${task.duration}h) doesn't fit in available time`);
        }
        return true;
    }

    /**
     * Check if slot is occupied
     */
    is_slot_occupied(slot_data) {
        if (!slot_data.machine || !slot_data.date) return false;
        const events = this.storage_service.get_events_by_date(slot_data.date);
        return events.some(event =>
            event.machine === slot_data.machine &&
            slot_data.hour >= event.startHour &&
            slot_data.hour < event.endHour
        );
    }

    /**
     * Check if slot is unavailable
     */
    is_slot_unavailable(slot_data) {
        if (!slot_data.machine || !slot_data.date) return false;
        const unavailable_hours = this.storage_service.getMachineAvailabilityForDate(slot_data.machine, slot_data.date);
        return unavailable_hours.includes(slot_data.hour);
    }

    /**
     * Validate task duration against available time
     */
    validate_task_duration(slot_data, task) {
        if (!slot_data.machine || !slot_data.date || !task?.duration > 0) return false;
        const events = this.storage_service.get_events_by_date(slot_data.date);
        const unavailable = this.storage_service.getMachineAvailabilityForDate(slot_data.machine, slot_data.date);

        for (let h = slot_data.hour; h < slot_data.hour + task.duration; h++) {
            const is_occupied = events.some(e => e.machine === slot_data.machine && h >= e.startHour && h < e.endHour);
            if (is_occupied || unavailable.includes(h)) return false;
        }
        return true;
    }

    /**
     * Schedule a task to a slot
     */
    schedule_task_to_slot(slot_data, task_id, slot) {
        const task = this.storage_service.getBacklogTaskById(task_id);
        if (!task) return this.show_error('Task not found');

        const event_data = {
            id: `${task_id}-${Date.now()}`,
            taskId: task_id,
            taskTitle: task.odp_number || 'Unknown Task',
            machine: slot_data.machine,
            date: slot_data.date,
            startHour: slot_data.hour,
            endHour: slot_data.hour + task.duration,
            color: task.color,
            duration: task.duration
        };

        try {
            this.storage_service.addScheduledEvent(event_data);
            this.show_success(`Task "${task.odp_number || 'Unknown Task'}" scheduled successfully`);
            this.options.on_success?.('schedule', event_data, slot);
        } catch (error) {
            this.show_error(`Failed to schedule task: ${error.message}`);
        }
    }

    /**
     * Unschedule a task
     */
    unschedule_task(event_id, task_pool) {
        try {
            this.storage_service.removeScheduledEvent(event_id);
            this.show_success('Task unscheduled successfully');
            this.options.on_success?.('unschedule', { id: event_id }, task_pool);
        } catch (error) {
            this.show_error(`Failed to unschedule task: ${error.message}`);
        }
    }

    /**
     * Toggle slot availability
     */
    toggle_slot_availability(slot_data, slot) {
        if (!slot_data.machine) return;
        try {
            this.storage_service.toggleMachineHourAvailability(slot_data.machine, slot_data.date, slot_data.hour);
            this.show_success('Slot availability updated');
            this.options.on_success?.('availability', slot_data, slot);
        } catch (error) {
            this.show_error(`Failed to update availability: ${error.message}`);
        }
    }

    /**
     * Extract slot data from DOM element
     */
    extract_slot_data(slot) {
        return {
            machine: slot.dataset.machine || null,
            hour: parseInt(slot.dataset.hour) || 0,
            date: slot.dataset.date || null,
            element: slot
        };
    }

    /**
     * Show slot preview on hover
     */
    show_slot_preview(slot, slot_data) {
        if (this.drag_state.is_dragging) this.show_drop_preview(slot, slot_data);
        else this.show_info_preview(slot, slot_data);
    }

    /**
     * Hide slot preview
     */
    hide_slot_preview(slot) {
        slot.removeAttribute('title');
        this.clear_slot_feedback(slot, 'preview');
    }

    /**
     * Show drop preview
     */
    show_drop_preview(slot, slot_data) {
        if (!this.drag_state.dragged_item) return;
        const task_id = this.drag_state.dragged_item.id.replace('pool-task-', '');
        const is_valid = this.validate_slot_for_drop(slot_data, task_id);
        slot.classList.add(is_valid ? 'valid-drop' : 'invalid-drop');
        slot.title = is_valid ? 'Drop here to schedule task' : 'Cannot drop here';
    }

    /**
     * Show info preview
     */
    show_info_preview(slot, slot_data) {
        const is_occupied = this.is_slot_occupied(slot_data);
        const is_unavailable = this.is_slot_unavailable(slot_data);
        let title = `${slot_data.hour}:00 - ${slot_data.machine}`;
        if (is_occupied) title += ' (Occupied)';
        else if (is_unavailable) title += ' (Unavailable)';
        else title += ' (Available)';
        slot.title = title;
    }

    /**
     * Show slot feedback
     */
    show_slot_feedback(slot, type) {
        slot.classList.add(`feedback-${type}`);
        if (this.options.feedback_duration > 0) {
            setTimeout(() => this.clear_slot_feedback(slot, type), this.options.feedback_duration);
        }
    }

    /**
     * Clear slot feedback
     */
    clear_slot_feedback(slot, type) {
        slot.classList.remove(`feedback-${type}`, 'valid-drop', 'invalid-drop');
    }

    /**
     * Clear all visual feedback
     */
    clear_all_feedback() {
        document.querySelectorAll('.time-slot, .task-pool-container').forEach(el => {
            el.classList.remove('drag-over', 'valid-drop', 'invalid-drop', 'highlighted');
            el.removeAttribute('title');
        });
    }

    /**
     * Show success message
     */
    show_success(message) {
        this.options.on_success?.('message', { message }, null);
    }

    /**
     * Show error message
     */
    show_error(message) {
        if (this.options.on_validation_error) {
            this.options.on_validation_error(message);
        } else {
            console.error('Error:', message);
            alert(message);
        }
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.clear_all_feedback();
        this.drag_state = { is_dragging: false, dragged_item: null, drag_start_time: null };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlotHandler;
}