/**
 * Shared Slot Handler - Unified slot interaction logic
 * Handles click, hover, and drag/drop interactions for calendar slots
 */
class SlotHandler {
    constructor(options = {}) {
        this.options = {
            enableDragDrop: options.enableDragDrop !== undefined ? options.enableDragDrop : true,
            enableClick: options.enableClick !== undefined ? options.enableClick : true,
            enableHover: options.enableHover !== undefined ? options.enableHover : true,
            feedbackDuration: options.feedbackDuration || 2000,
            ...options
        };
        
        this.storageService = window.storageService;
        this.callbacks = {
            onSlotClick: options.onSlotClick || null,
            onSlotDrop: options.onSlotDrop || null,
            onSlotHover: options.onSlotHover || null,
            onValidationError: options.onValidationError || null,
            onSuccess: options.onSuccess || null
        };
        
        this.dragState = {
            isDragging: false,
            draggedItem: null,
            dragStartTime: null
        };
    }
    
    /**
     * Initialize slot interactions for a container
     */
    initializeSlots(container) {
        if (!container) return;
        
        const slots = container.querySelectorAll('.time-slot.interactive');
        
        slots.forEach(slot => {
            this.setupSlotInteractions(slot);
        });
        
        // Setup task pool interactions if present
        const taskPool = container.querySelector('.task-pool-container, #taskPool');
        if (taskPool) {
            this.setupTaskPoolInteractions(taskPool);
        }
    }
    
    /**
     * Setup interactions for a single slot
     */
    setupSlotInteractions(slot) {
        // Click interactions
        if (this.options.enableClick && this.callbacks.onSlotClick) {
            slot.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSlotClick(slot, e);
            });
        }
        
        // Hover interactions
        if (this.options.enableHover) {
            slot.addEventListener('mouseenter', (e) => {
                this.handleSlotHover(slot, e, 'enter');
            });
            
            slot.addEventListener('mouseleave', (e) => {
                this.handleSlotHover(slot, e, 'leave');
            });
        }
        
        // Drag and drop interactions
        if (this.options.enableDragDrop) {
            this.setupDragDropForSlot(slot);
        }
    }
    
    /**
     * Setup drag and drop for a slot
     */
    setupDragDropForSlot(slot) {
        // Allow drops
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (!slot.classList.contains('drag-over')) {
                slot.classList.add('drag-over');
                this.showSlotFeedback(slot, 'drag-over');
            }
        });
        
        slot.addEventListener('dragleave', (e) => {
            // Only remove if we're actually leaving the slot
            if (!slot.contains(e.relatedTarget)) {
                slot.classList.remove('drag-over');
                this.clearSlotFeedback(slot, 'drag-over');
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
    setupTaskPoolInteractions(taskPool) {
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
    handleSlotClick(slot, event) {
        const slotData = this.extractSlotData(slot);
        
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
    handleSlotHover(slot, event, action) {
        const slotData = this.extractSlotData(slot);
        
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
    handleSlotDrop(slot, event) {
        event.preventDefault();
        event.stopPropagation();
        
        const slotData = this.extractSlotData(slot);
        const taskId = event.dataTransfer.getData('text/plain');
        
        if (!taskId) {
            this.showError('Invalid task data');
            return;
        }
        
        // Check if slot is valid for dropping
        if (!this.validateSlotForDrop(slotData, taskId)) {
            return;
        }
        
        if (this.callbacks.onSlotDrop) {
            this.callbacks.onSlotDrop(slotData, taskId, event, slot);
        } else {
            // Default behavior: schedule task
            this.scheduleTaskToSlot(slotData, taskId, slot);
        }
    }
    
    /**
     * Handle task pool drop events
     */
    handleTaskPoolDrop(taskPool, event) {
        const eventId = event.dataTransfer.getData('text/plain');
        
        if (!eventId) {
            this.showError('Invalid event data');
            return;
        }
        
        // Try to get event data
        let eventData;
        try {
            eventData = JSON.parse(event.dataTransfer.getData('application/json'));
        } catch (e) {
            // Fallback to just the ID
            eventData = { id: eventId };
        }
        
        if (eventData.source === 'pool') {
            // Task is already in pool, no action needed
            return;
        }
        
        this.unscheduleTask(eventId, taskPool);
    }
    
    /**
     * Validate if a slot can accept a drop
     */
    validateSlotForDrop(slotData, taskId) {
        if (!this.storageService) {
            this.showError('Storage service not available');
            return false;
        }
        
        // Check if slot is already occupied
        if (this.isSlotOccupied(slotData)) {
            this.showError('This time slot is already occupied');
            return false;
        }
        
        // Check if slot is unavailable
        if (this.isSlotUnavailable(slotData)) {
            this.showError('This time slot is marked as unavailable');
            return false;
        }
        
        // Get task data to validate duration
        const task = this.storageService.getBacklogTaskById(taskId);
        if (!task) {
            this.showError('Task not found');
            return false;
        }
        
        // Check if task duration fits
        if (!this.validateTaskDuration(slotData, task)) {
            this.showError(`Task duration (${task.duration}h) doesn't fit in available time`);
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if slot is occupied
     */
    isSlotOccupied(slotData) {
        if (!slotData.machine || !slotData.date) return false;
        
        const events = this.storageService.getEventsByDate(slotData.date);
        
        return events.some(event => 
            event.machine === slotData.machine &&
            slotData.hour >= event.startHour && 
            slotData.hour < event.endHour
        );
    }
    
    /**
     * Check if slot is unavailable
     */
    isSlotUnavailable(slotData) {
        if (!slotData.machine || !slotData.date) return false;
        
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(
            slotData.machine, 
            slotData.date
        );
        
        return unavailableHours.includes(slotData.hour);
    }
    
    /**
     * Validate task duration against available time
     */
    validateTaskDuration(slotData, task) {
        if (!slotData.machine || !slotData.date) return false;
        if (!task || !task.duration || task.duration <= 0) return false;
        
        const events = this.storageService.getEventsByDate(slotData.date);
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(
            slotData.machine, 
            slotData.date
        );
        
        // Check each hour in the task duration
        for (let h = slotData.hour; h < slotData.hour + task.duration; h++) {
            // Check if hour is occupied
            const isOccupied = events.some(event => 
                event.machine === slotData.machine &&
                h >= event.startHour && 
                h < event.endHour
            );
            
            // Check if hour is unavailable
            const isUnavailable = unavailableHours.includes(h);
            
            if (isOccupied || isUnavailable) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Schedule a task to a slot
     */
    scheduleTaskToSlot(slotData, taskId, slot) {
        const task = this.storageService.getBacklogTaskById(taskId);
        if (!task) {
            this.showError('Task not found');
            return;
        }
        
        const eventData = {
            id: `${taskId}-${Date.now()}`,
            taskId: taskId,
            taskTitle: task.name,
            machine: slotData.machine,
            date: slotData.date,
            startHour: slotData.hour,
            endHour: slotData.hour + task.duration,
            color: task.color,
            duration: task.duration
        };
        
        try {
            this.storageService.addScheduledEvent(eventData);
            this.showSuccess(`Task "${task.name}" scheduled successfully`);
            
            if (this.callbacks.onSuccess) {
                this.callbacks.onSuccess('schedule', eventData, slot);
            }
        } catch (error) {
            this.showError(`Failed to schedule task: ${error.message}`);
        }
    }
    
    /**
     * Unschedule a task
     */
    unscheduleTask(eventId, taskPool) {
        try {
            this.storageService.removeScheduledEvent(eventId);
            this.showSuccess('Task unscheduled successfully');
            
            if (this.callbacks.onSuccess) {
                this.callbacks.onSuccess('unschedule', { id: eventId }, taskPool);
            }
        } catch (error) {
            this.showError(`Failed to unschedule task: ${error.message}`);
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
    extractSlotData(slot) {
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
    showSlotPreview(slot, slotData) {
        if (this.dragState.isDragging) {
            // Show drop preview
            this.showDropPreview(slot, slotData);
        } else {
            // Show info preview
            this.showInfoPreview(slot, slotData);
        }
    }
    
    /**
     * Hide slot preview
     */
    hideSlotPreview(slot, slotData) {
        slot.removeAttribute('title');
        this.clearSlotFeedback(slot, 'preview');
    }
    
    /**
     * Show drop preview
     */
    showDropPreview(slot, slotData) {
        if (!this.dragState.draggedItem) return;
        
        const taskId = this.dragState.draggedItem.id.replace('pool-task-', '');
        const isValid = this.validateSlotForDrop(slotData, taskId);
        
        if (isValid) {
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
    showInfoPreview(slot, slotData) {
        const isOccupied = this.isSlotOccupied(slotData);
        const isUnavailable = this.isSlotUnavailable(slotData);
        
        let title = `${slotData.hour}:00`;
        if (slotData.machine) {
            title += ` - ${slotData.machine}`;
        }
        
        if (isOccupied) {
            title += ' (Occupied)';
        } else if (isUnavailable) {
            title += ' (Unavailable)';
        } else {
            title += ' (Available)';
        }
        
        slot.title = title;
    }
    
    /**
     * Show slot feedback
     */
    showSlotFeedback(slot, type) {
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
    clearSlotFeedback(slot, type) {
        slot.classList.remove(`feedback-${type}`, 'valid-drop', 'invalid-drop');
    }
    
    /**
     * Clear all visual feedback
     */
    clearAllFeedback() {
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
    showSuccess(message) {
        if (this.callbacks.onSuccess) {
            this.callbacks.onSuccess('message', { message }, null);
        } else {
            console.log('Success:', message);
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        if (this.callbacks.onValidationError) {
            this.callbacks.onValidationError(message);
        } else {
            console.error('Error:', message);
            alert(message); // Fallback alert
        }
    }
    
    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.clearAllFeedback();
        this.dragState = {
            isDragging: false,
            draggedItem: null,
            dragStartTime: null
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlotHandler;
}