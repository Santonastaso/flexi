/**
 * Production Scheduler - Main scheduling system with drag-and-drop functionality
 * Now uses shared calendar components for consistency with machinery settings
 */
class ProductionScheduler {
    constructor() {
        this.storageService = window.storageService;
        this.elements = {};
        
        // Configuration
        this.config = {
            START_HOUR: 8,
            END_HOUR: 20,
            SLOT_WIDTH: 80,
            LABEL_WIDTH: 150
        };
        
        // State
        this.currentDate = new Date("2025-08-01T00:00:00");
        this.currentDate.setHours(0, 0, 0, 0);
        
        // Shared components
        this.calendarRenderer = null;
        this.slotHandler = null;
        
        this.init();
    }
    
    /**
     * Initialize the scheduler
     */
    init() {
        this.bindElements();
        this.attachEventListeners();
        this.initializeSharedComponents();
        this.loadTasksIntoPool();
        this.renderScheduler();
        this.updateDateDisplay();
    }
    
    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            taskPool: document.getElementById('taskPool'),
            calendarContainer: document.getElementById('calendarContainer'),
            currentDate: document.getElementById('currentDate'),
            todayBtn: document.getElementById('todayBtn'),
            prevDay: document.getElementById('prevDay'),
            nextDay: document.getElementById('nextDay')
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
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.elements.todayBtn) return;
        
        this.elements.todayBtn.addEventListener('click', () => this.goToToday());
        this.elements.prevDay.addEventListener('click', () => this.previousDay());
        this.elements.nextDay.addEventListener('click', () => this.nextDay());
    }
    
    /**
     * Initialize shared calendar components
     */
    initializeSharedComponents() {
        // Get all machines for the calendar
        const machines = this.storageService.getMachines();
        
        // Initialize shared calendar renderer
        this.calendarRenderer = new SharedCalendarRenderer(this.elements.calendarContainer, {
            startHour: this.config.START_HOUR,
            endHour: this.config.END_HOUR,
            showMachines: true,
            interactive: true,
            currentDate: this.currentDate,
            machines: machines
        });
        
        // Initialize slot handler with custom callbacks
        this.slotHandler = new SlotHandler({
            enableDragDrop: true,
            enableClick: false, // Disable click for scheduler (only drag/drop)
            enableHover: true,
            onSlotDrop: (slotData, taskId, event, slot) => this.handleSlotDrop(slotData, taskId, event, slot),
            onValidationError: (message) => this.showMessage(message, 'error'),
            onSuccess: (type, data, element) => this.handleSuccess(type, data, element)
        });
    }
    
    /**
     * Render the entire scheduler
     */
    renderScheduler() {
        if (!this.calendarRenderer) return;
        
        // Update calendar date and machines
        this.calendarRenderer.updateDate(this.currentDate);
        this.calendarRenderer.updateMachines(this.storageService.getMachines());
        
        // Render the calendar
        this.calendarRenderer.render();
        
        // Initialize slot interactions
        this.slotHandler.initializeSlots(this.elements.calendarContainer);
        
        // Render events
        this.renderAllScheduledEvents();
    }
    
    /**
     * Handle slot drop events
     */
    handleSlotDrop(slotData, taskId, event, slot) {
        const task = this.storageService.getBacklogTaskById(taskId);
        if (!task) {
            this.showMessage('Task not found', 'error');
            return;
        }
        
        // Check if slot can accommodate the task
        if (!this.canScheduleTask(slotData, task)) {
            return; // Error already shown by validation
        }
        
        // Create the scheduled event
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
            this.showMessage(`Task "${task.name}" scheduled successfully`, 'success');
            
            // Refresh the entire scheduler
            this.refreshScheduler();
        } catch (error) {
            this.showMessage(`Failed to schedule task: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handle success callbacks from slot handler
     */
    handleSuccess(type, data, element) {
        switch (type) {
            case 'schedule':
                this.refreshScheduler();
                break;
            case 'unschedule':
                this.refreshScheduler();
                break;
            case 'message':
                this.showMessage(data.message, 'success');
                break;
        }
    }
    
    /**
     * Check if a task can be scheduled at a specific slot
     */
    canScheduleTask(slotData, task) {
        return this.slotHandler.validateSlotForDrop(slotData, task.id);
    }
    
    /**
     * Show user feedback messages
     */
    showMessage(message, type = 'info') {
        // Create or update message element
        let messageEl = document.getElementById('scheduler-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'scheduler-message';
            messageEl.className = 'scheduler-message';
            
            // Insert after the task pool
            const taskPool = this.elements.taskPool;
            if (taskPool && taskPool.parentNode) {
                taskPool.parentNode.insertBefore(messageEl, taskPool.nextSibling);
            }
        }
        
        messageEl.className = `scheduler-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        }, 3000);
    }
    
    /**
     * Check if a time slot is occupied by existing events or machine unavailability
     */
    isTimeSlotOccupied(checkEvent) {
        const dateKey = this.currentDate.toISOString().split('T')[0];
        const existingEvents = this.storageService.getEventsByDate(dateKey);
        
        // Check for overlapping events on the same machine
        for (const existingEvent of existingEvents) {
            if (existingEvent.id === checkEvent.id || existingEvent.machine !== checkEvent.machine) {
                continue;
            }
            
            // Check for time overlap
            if (checkEvent.startHour < existingEvent.endHour && 
                checkEvent.endHour > existingEvent.startHour) {
                return true;
            }
        }
        
        // Check machine availability
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(
            checkEvent.machine, 
            dateKey
        );
        
        for (let h = checkEvent.startHour; h < checkEvent.endHour; h++) {
            if (unavailableHours.includes(h)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Render the main scheduling grid
     */
    renderGrid() {
        if (!this.elements.calendarContainer) return;
        
        this.elements.calendarContainer.innerHTML = '';
        
        // Create header
        const header = this.createHeader();
        this.elements.calendarContainer.appendChild(header);
        
        // Create body with machine rows
        const body = this.createBody();
        this.elements.calendarContainer.appendChild(body);
        
        // Setup drag and drop zones
        this.setupDropZones();
    }
    
    /**
     * Create calendar header
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        
        // Label spacer
        const labelSpacer = document.createElement('div');
        labelSpacer.className = 'header-label-spacer';
        header.appendChild(labelSpacer);
        
        // Time slots
        const timelineGrid = document.createElement('div');
        timelineGrid.className = 'timeline-grid';
        
        for (let hour = this.config.START_HOUR; hour < this.config.END_HOUR; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'header-time-slot';
            timeSlot.textContent = `${hour}:00`;
            timelineGrid.appendChild(timeSlot);
        }
        
        header.appendChild(timelineGrid);
        return header;
    }
    
    /**
     * Create calendar body with machine rows
     */
    createBody() {
        const body = document.createElement('div');
        body.className = 'calendar-body';
        
        const machines = this.storageService.getLiveMachines();
        const dateKey = this.currentDate.toISOString().split('T')[0];
        
        machines.forEach((machine) => {
            const machineRow = this.createMachineRow(machine, dateKey);
            body.appendChild(machineRow);
        });
        
        return body;
    }
    
    /**
     * Create a machine row
     */
    createMachineRow(machine, dateKey) {
        const machineRow = document.createElement('div');
        machineRow.className = 'machine-row';
        machineRow.dataset.machineName = machine.name;
        
        // Machine label
        const labelCol = document.createElement('div');
        labelCol.className = 'machine-label-col';
        labelCol.textContent = machine.name;
        machineRow.appendChild(labelCol);
        
        // Schedule area
        const scheduleArea = document.createElement('div');
        scheduleArea.className = 'machine-schedule-area';
        
        // Get unavailable hours for this machine and date
        const unavailableHours = this.storageService.getMachineAvailabilityForDate(
            machine.name, 
            dateKey
        );
        
        // Create time slots
        for (let hour = this.config.START_HOUR; hour < this.config.END_HOUR; hour++) {
            const slot = document.createElement('div');
            slot.className = 'machine-slot';
            slot.dataset.hour = hour;
            
            if (unavailableHours.includes(hour)) {
                slot.classList.add('unavailable');
                slot.textContent = 'X';
            }
            
            scheduleArea.appendChild(slot);
        }
        
        machineRow.appendChild(scheduleArea);
        return machineRow;
    }
    
    /**
     * Schedule a task from the pool to a time slot
     */
    scheduleTask(task, dropZone) {
        const machineRow = dropZone.closest('.machine-row');
        const machineName = machineRow.dataset.machineName;
        const startHour = parseInt(dropZone.dataset.hour);
        const endHour = startHour + task.duration;
        
        // Validate task fits in the day
        if (endHour > this.config.END_HOUR) {
            alert('Task does not fit in the remaining time slots.');
            return false;
        }
        
        const dateKey = this.currentDate.toISOString().split('T')[0];
        const eventToCheck = {
            id: task.id,
            machine: machineName,
            startHour,
            endHour
        };
        
        // Check if time slot is available
        if (this.isTimeSlotOccupied(eventToCheck)) {
            alert('This time slot is occupied or unavailable.');
            return false;
        }
        
        // Create scheduled event
        const event = {
            ...task,
            date: dateKey,
            machine: machineName,
            startHour,
            endHour
        };
        
        // Save to storage
        this.storageService.addScheduledEvent(event);
        
        // Remove from task pool
        const poolTaskElement = document.getElementById(`pool-task-${task.id}`);
        if (poolTaskElement) {
            poolTaskElement.remove();
        }
        
        // Render the event
        this.renderEvent(event);
        
        return true;
    }
    
    /**
     * Move an existing event to a new time slot
     */
    moveEvent(event, dropZone) {
        const machineRow = dropZone.closest('.machine-row');
        const newMachineName = machineRow.dataset.machineName;
        const startHour = parseInt(dropZone.dataset.hour);
        const endHour = startHour + event.duration;
        
        // Validate task fits
        if (endHour > this.config.END_HOUR) {
            alert('Task does not fit in the remaining time slots.');
            return false;
        }
        
        const eventToCheck = {
            id: event.id,
            machine: newMachineName,
            startHour,
            endHour
        };
        
        // Check if new time slot is available
        if (this.isTimeSlotOccupied(eventToCheck)) {
            alert('This time slot is occupied or unavailable.');
            return false;
        }
        
        // Update event
        event.machine = newMachineName;
        event.startHour = startHour;
        event.endHour = endHour;
        
        // Save to storage
        this.storageService.saveScheduledEvents(this.storageService.getScheduledEvents());
        
        // Reposition the event element
        this.repositionEvent(event);
        
        return true;
    }
    
    /**
     * Render an event on the calendar
     */
    renderEvent(event) {
        const safeMachineName = CSS.escape(event.machine);
        const machineRow = document.querySelector(`.machine-row[data-machine-name="${safeMachineName}"]`);
        const scheduleArea = machineRow?.querySelector('.machine-schedule-area');
        
        if (!scheduleArea) {
            console.error('Could not find schedule area for machine:', event.machine);
            return;
        }
        
        const eventElement = document.createElement('div');
        eventElement.className = 'event';
        eventElement.id = `event-${event.id}`;
        eventElement.style.backgroundColor = event.color;
        eventElement.style.left = `${(event.startHour - this.config.START_HOUR) * this.config.SLOT_WIDTH}px`;
        eventElement.style.width = `${event.duration * this.config.SLOT_WIDTH}px`;
        eventElement.textContent = `${event.name} (${event.duration}h)`;
        eventElement.draggable = true;
        
        // Add drag event listener
        eventElement.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.setData('text/plain', event.id);
        });
        
        scheduleArea.appendChild(eventElement);
    }
    
    /**
     * Setup drag and drop zones
     */
    setupDropZones() {
        // Machine slots
        const machineSlots = document.querySelectorAll('.machine-slot:not(.unavailable)');
        machineSlots.forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                slot.classList.add('drag-over');
            });
            
            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });
            
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                this.handleDropOnGrid(e, slot);
            });
        });
        
        // Task pool
        const taskPool = this.elements.taskPool;
        if (taskPool) {
            taskPool.addEventListener('dragover', (e) => {
                e.preventDefault();
                taskPool.classList.add('drag-over');
            });
            
            taskPool.addEventListener('dragleave', () => {
                taskPool.classList.remove('drag-over');
            });
            
            taskPool.addEventListener('drop', (e) => {
                e.preventDefault();
                taskPool.classList.remove('drag-over');
                this.handleDropOnPool(e);
            });
        }
    }
    
    /**
     * Load tasks into the task pool
     */
    loadTasksIntoPool() {
        if (!this.elements.taskPool) return;
        
        // Clear existing tasks to prevent duplication
        this.elements.taskPool.innerHTML = '';
        
        const tasks = this.storageService.getBacklogTasks();
        const scheduledEvents = this.storageService.getScheduledEvents();
        
        tasks.forEach(task => {
            // Only show tasks that aren't currently scheduled
            if (!scheduledEvents.some(event => event.id === task.id)) {
                this.renderTaskInPool(task);
            }
        });
    }
    
    /**
     * Render a task in the task pool
     */
    renderTaskInPool(task) {
        if (!this.elements.taskPool) return;
        
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.id = `pool-task-${task.id}`;
        taskElement.dataset.taskId = task.id;
        taskElement.style.backgroundColor = task.color;
        taskElement.textContent = `${task.name} (${task.duration}h)`;
        taskElement.draggable = true;
        
        taskElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id);
            e.dataTransfer.setData('application/json', JSON.stringify({
                id: task.id,
                source: 'pool'
            }));
            taskElement.classList.add('dragging');
        });
        
        taskElement.addEventListener('dragend', (e) => {
            taskElement.classList.remove('dragging');
        });
        
        this.elements.taskPool.appendChild(taskElement);
    }
    
    /**
     * Handle dropping on the grid
     */
    handleDropOnGrid(e, dropZone) {
        const taskId = e.dataTransfer.getData('text/plain');
        
        // Check if it's a task from the pool
        const poolTask = this.storageService.getTaskById(taskId);
        if (poolTask && !this.storageService.isTaskScheduled(taskId)) {
            this.scheduleTask(poolTask, dropZone);
            return;
        }
        
        // Check if it's an existing scheduled event
        const scheduledEvents = this.storageService.getScheduledEvents();
        const scheduledEvent = scheduledEvents.find(e => e.id == taskId);
        if (scheduledEvent) {
            this.moveEvent(scheduledEvent, dropZone);
        }
    }
    
    /**
     * Handle dropping on the task pool (unscheduling)
     */
    handleDropOnPool(e) {
        const taskId = e.dataTransfer.getData('text/plain');
        const scheduledEvents = this.storageService.getScheduledEvents();
        const eventIndex = scheduledEvents.findIndex(evt => evt.id == taskId);
        
        if (eventIndex > -1) {
            const [unscheduledEvent] = scheduledEvents.splice(eventIndex, 1);
            this.storageService.saveScheduledEvents(scheduledEvents);
            
            // Remove event element
            const eventElement = document.getElementById(`event-${unscheduledEvent.id}`);
            if (eventElement) {
                eventElement.remove();
            }
            
            // Add back to task pool
            const originalTask = this.storageService.getTaskById(unscheduledEvent.id);
            if (originalTask) {
                this.renderTaskInPool(originalTask);
            }
        }
    }
    
    /**
     * Render all scheduled events for the current date
     */
    renderAllScheduledEvents() {
        if (!this.calendarRenderer) return;
        
        const dateKey = this.currentDate.toISOString().split('T')[0];
        const events = this.storageService.getEventsByDate(dateKey);
        
        // Use the shared calendar renderer to render events
        this.calendarRenderer.renderEvents(events);
    }
    
    /**
     * Reposition an event element
     */
    repositionEvent(event) {
        const eventElement = document.getElementById(`event-${event.id}`);
        const safeMachineName = CSS.escape(event.machine);
        const newParent = document.querySelector(`.machine-row[data-machine-name="${safeMachineName}"] .machine-schedule-area`);
        
        if (eventElement && newParent) {
            eventElement.style.left = `${(event.startHour - this.config.START_HOUR) * this.config.SLOT_WIDTH}px`;
            newParent.appendChild(eventElement);
        }
    }
    
    /**
     * Navigation methods
     */
    goToToday() {
        this.currentDate = new Date("2025-08-01T00:00:00");
        this.currentDate.setHours(0, 0, 0, 0);
        this.refreshScheduler();
    }
    
    previousDay() {
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        this.refreshScheduler();
    }
    
    nextDay() {
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.refreshScheduler();
    }
    
    /**
     * Update the date display
     */
    updateDateDisplay() {
        if (!this.elements.currentDate) return;
        
        const today = new Date("2025-08-01T00:00:00");
        today.setHours(0, 0, 0, 0);
        
        if (this.currentDate.getTime() === today.getTime()) {
            this.elements.currentDate.textContent = 'Today';
        } else {
            this.elements.currentDate.textContent = this.currentDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric'
            });
        }
    }
    
    /**
     * Refresh the entire scheduler
     */
    refreshScheduler() {
        this.renderScheduler();
        this.loadTasksIntoPool();
        this.updateDateDisplay();
    }
    
    /**
     * Public method to refresh from external sources
     */
    refresh() {
        this.refreshScheduler();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the scheduler page
    if (document.getElementById('calendarContainer')) {
        window.productionScheduler = new ProductionScheduler();
    }
});