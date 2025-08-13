/**
 * Shared Slot Handler - Unified slot interaction logic
 * Handles click, hover, and drag/drop interactions for calendar slots
 */
class SlotHandler {
    constructor(options = {}) {
        this.options = {
            enable_drag_drop: options.enableDragDrop !== undefined ? options.enableDragDrop : true,
            enable_click: options.enableClick !== undefined ? options.enableClick : true,
            enable_hover: options.enableHover !== undefined ? options.enableHover : true,
            feedback_duration: options.feedbackDuration || 2000,
            ...options
        };
        
        this.storage_service = window.storageService;
        this.callbacks = {
            on_slot_click: options.onSlotClick || null,
            on_slot_drop: options.onSlotDrop || null,
            on_slot_hover: options.onSlotHover || null,
            on_validation_error: options.onValidationError || null,
            on_success: options.onSuccess || null
        };
        
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
        
        const slots = container.querySelectorAll('.time-slot.interactive');
        
        slots.forEach(slot => {
            this.setup_slot_interactions(slot);
        });
        
        // Setup task pool interactions if present
        const task_pool = container.querySelector('.task-pool-container, #taskPool');
        if (task_pool) {
            this.setup_task_pool_interactions(task_pool);
        }
    }
    
    /**
     * Setup interactions for a single slot
     */
    setup_slot_interactions(slot) {
        // Click interactions
        if (this.options.enable_click && this.callbacks.on_slot_click) {
            slot.addEventListener('click', (e) => {
                e.preventDefault();
                this.handle_slot_click(slot, e);
            });
        }
        
        // Hover interactions
        if (this.options.enable_hover) {
            slot.addEventListener('mouseenter', (e) => {
                this.handle_slot_hover(slot, e, 'enter');
            });
            
            slot.addEventListener('mouseleave', (e) => {
                this.handle_slot_hover(slot, e, 'leave');
            });
        }
        
        // Drag and drop interactions
        if (this.options.enable_drag_drop) {
            this.setup_drag_drop_for_slot(slot);
        }
    }
    
    /**
     * Setup drag and drop for a slot
     */
    setup_drag_drop_for_slot(slot) {
        // Allow drops
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (!slot.classList.contains('drag-over')) {
                slot.classList.add('drag-over');
                this.show_slot_feedback(slot, 'drag-over');
            }
        });
        
        slot.addEventListener('dragleave', (e) => {
            // Only remove if we're actually leaving the slot
            if (!slot.contains(e.relatedTarget)) {
                slot.classList.remove('drag-over');
                this.clear_slot_feedback(slot, 'drag-over');
            }
        });
        
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            this.clearSlotFeedback(slot, 'drag-over');
            
            this.handleSlotDrop(slot, e);
        });
    }
    
    /**
     * Setup task pool interactions
     */
    setup_task_pool_interactions(task_pool) {
        // Update class for consistency
        if (!taskPool.classList.contains('task-pool-container')) {
            taskPool.classList.add('task-pool-container');
        }
        
        // Allow drops to unschedule tasks
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
            
            this.handleTaskPoolDrop(taskPool, e);
        });
        
        // Setup draggable tasks
        this.setupTaskDragging(taskPool);
    }
    
    /**
     * Setup dragging for tasks in the pool
     */
    setupTaskDragging(taskPool) {
        const tasks = taskPool.querySelectorAll('.task-item');
        
        tasks.forEach(task => {
            task.draggable = true;
            
            task.addEventListener('dragstart', (e) => {
                this.dragState.isDragging = true;
                this.dragState.draggedItem = task;
                this.dragState.dragStartTime = Date.now();
                
                task.classList.add('dragging');
                
                // Set drag data
                const taskId = task.id.replace('pool-task-', '') || task.dataset.taskId;
                e.dataTransfer.setData('text/plain', taskId);
                e.dataTransfer.setData('application/json', JSON.stringify({
                    id: taskId,
                    source: 'pool'
                }));
                
                e.dataTransfer.effectAllowed = 'move';
            });
            
            task.addEventListener('dragend', (e) => {
                this.dragState.isDragging = false;
                this.dragState.draggedItem = null;
                task.classList.remove('dragging');
                
                // Clear any remaining visual feedback
                this.clearAllFeedback();
            });
        });
    }
    
    /**
     * Handle slot click events
     */
    handle_slot_click(slot, event) {
        const slot_data = this.extract_slot_data(slot);
        
        if (this.callbacks.onSlotClick) {
            this.callbacks.onSlotClick(slotData, event, slot);
        } else {
            // Default behavior: toggle availability
            this.toggleSlotAvailability(slotData, slot);
        }
    }
    
    /**
     * Handle slot hover events
     */
    handle_slot_hover(slot, event, action) {
        const slot_data = this.extract_slot_data(slot);
        
        if (action === 'enter') {
            this.showSlotPreview(slot, slotData);
        } else {
            this.hideSlotPreview(slot, slotData);
        }
        
        if (this.callbacks.onSlotHover) {
            this.callbacks.onSlotHover(slotData, event, slot, action);
        }
    }
    
    /**
     * Handle slot drop events
     */
    handle_slot_drop(slot, event) {
        event.preventDefault();
        event.stopPropagation();
        
        const slot_data = this.extract_slot_data(slot);
        const task_id = event.dataTransfer.getData('text/plain');
        
        if (!task_id) {
            this.show_error('Invalid task data');
            return;
        }
        
        // Check if slot is valid for dropping
        if (!this.validate_slot_for_drop(slot_data, task_id)) {
            return;
        }
        
        if (this.callbacks.on_slot_drop) {
            this.callbacks.on_slot_drop(slot_data, task_id, event, slot);
        } else {
            // Default behavior: schedule task
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
        
        // Try to get event data
        let event_data;
        try {
            event_data = JSON.parse(event.dataTransfer.getData('application/json'));
        } catch (e) {
            // Fallback to just the ID
            event_data = { id: event_id };
        }
        
        if (event_data.source === 'pool') {
            // Task is already in pool, no action needed
            return;
        }
        
        this.unschedule_task(event_id, task_pool);
    }
    
    /**
     * Validate if a slot can accept a drop
     */
    validate_slot_for_drop(slot_data, task_id) {
        if (!this.storage_service) {
            this.show_error('Storage service not available');
            return false;
        }
        
        // Check if slot is already occupied
        if (this.is_slot_occupied(slot_data)) {
            this.show_error('This time slot is already occupied');
            return false;
        }
        
        // Check if slot is unavailable
        if (this.is_slot_unavailable(slot_data)) {
            this.show_error('This time slot is marked as unavailable');
            return false;
        }
        
        // Get task data to validate duration
        const task = this.storage_service.getBacklogTaskById(task_id);
        if (!task) {
            this.show_error('Task not found');
            return false;
        }
        
        // Check if task duration fits
        if (!this.validate_task_duration(slot_data, task)) {
            this.show_error(`Task duration (${task.duration}h) doesn't fit in available time`);
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if slot is occupied
     */
    is_slot_occupied(slot_data) {
        if (!slot_data.machine || !slot_data.date) return false;
        
        const events = this.storage_service.getEventsByDate(slot_data.date);
        
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
        
        const unavailable_hours = this.storage_service.getMachineAvailabilityForDate(
            slot_data.machine, 
            slot_data.date
        );
        
        return unavailable_hours.includes(slot_data.hour);
    }
    
    /**
     * Validate task duration against available time
     */
    validate_task_duration(slot_data, task) {
        if (!slot_data.machine || !slot_data.date) return false;
        if (!task || !task.duration || task.duration <= 0) return false;
        
        const events = this.storage_service.getEventsByDate(slot_data.date);
        const unavailable_hours = this.storage_service.getMachineAvailabilityForDate(
            slot_data.machine, 
            slot_data.date
        );
        
        // Check each hour in the task duration
        for (let h = slot_data.hour; h < slot_data.hour + task.duration; h++) {
            // Check if hour is occupied
            const is_occupied = events.some(event => 
                event.machine === slot_data.machine &&
                h >= event.startHour && 
                h < event.endHour
            );
            
            // Check if hour is unavailable
            const is_unavailable = unavailable_hours.includes(h);
            
            if (is_occupied || is_unavailable) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Schedule a task to a slot
     */
    schedule_task_to_slot(slot_data, task_id, slot) {
        const task = this.storage_service.getBacklogTaskById(task_id);
        if (!task) {
            this.show_error('Task not found');
            return;
        }
        
        const event_data = {
            id: `${task_id}-${Date.now()}`,
            taskId: task_id,
            taskTitle: task.name,
            machine: slot_data.machine,
            date: slot_data.date,
            startHour: slot_data.hour,
            endHour: slot_data.hour + task.duration,
            color: task.color,
            duration: task.duration
        };
        
        try {
            this.storage_service.addScheduledEvent(event_data);
            this.show_success(`Task "${task.name}" scheduled successfully`);
            
            if (this.callbacks.on_success) {
                this.callbacks.on_success('schedule', event_data, slot);
            }
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
            
            if (this.callbacks.on_success) {
                this.callbacks.on_success('unschedule', { id: event_id }, task_pool);
            }
        } catch (error) {
            this.show_error(`Failed to unschedule task: ${error.message}`);
        }
    }
    
    /**
     * Toggle slot availability
     */
    toggleSlotAvailability(slotData, slot) {
        if (!slotData.machine) return; // Only works for machine slots
        
        try {
            this.storageService.toggleMachineHourAvailability(
                slotData.machine, 
                slotData.date, 
                slotData.hour
            );
            
            this.showSuccess('Slot availability updated');
            
            if (this.callbacks.onSuccess) {
                this.callbacks.onSuccess('availability', slotData, slot);
            }
        } catch (error) {
            this.showError(`Failed to update availability: ${error.message}`);
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
        if (this.drag_state.is_dragging) {
            // Show drop preview
            this.show_drop_preview(slot, slot_data);
        } else {
            // Show info preview
            this.show_info_preview(slot, slot_data);
        }
    }
    
    /**
     * Hide slot preview
     */
    hide_slot_preview(slot, slot_data) {
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
        
        if (is_valid) {
            slot.classList.add('valid-drop');
            slot.title = 'Drop here to schedule task';
        } else {
            slot.classList.add('invalid-drop');
            slot.title = 'Cannot drop here';
        }
    }
    /**
     * Show info preview
     */
    show_info_preview(slot, slot_data) {
        const is_occupied = this.is_slot_occupied(slot_data);
        const is_unavailable = this.is_slot_unavailable(slot_data);
        
        let title = `${slot_data.hour}:00`;
        if (slot_data.machine) {
            title += ` - ${slot_data.machine}`;
        }
        
        if (is_occupied) {
            title += ' (Occupied)';
        } else if (is_unavailable) {
            title += ' (Unavailable)';
        } else {
            title += ' (Available)';
        }
        
        slot.title = title;
    }
    
    /**
     * Show slot feedback
     */
    show_slot_feedback(slot, type) {
        slot.classList.add(`feedback-${type}`);
        
        if (this.options.feedbackDuration > 0) {
            setTimeout(() => {
                this.clearSlotFeedback(slot, type);
            }, this.options.feedbackDuration);
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
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('drag-over', 'valid-drop', 'invalid-drop', 'highlighted');
            slot.removeAttribute('title');
        });
        
        document.querySelectorAll('.task-pool-container').forEach(pool => {
            pool.classList.remove('drag-over');
        });
    }
    
    /**
     * Show success message
     */
    show_success(message) {
        if (this.callbacks.on_success) {
            this.callbacks.on_success('message', { message }, null);
        } else {
        }
    }
    
    /**
     * Show error message
     */
    show_error(message) {
        if (this.callbacks.on_validation_error) {
            this.callbacks.on_validation_error(message);
        } else {
            console.error('Error:', message);
            alert(message); // Fallback alert
        }
    }
    
    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.clear_all_feedback();
        this.drag_state = {
            is_dragging: false,
            dragged_item: null,
            drag_start_time: null
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlotHandler;
}