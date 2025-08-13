/**
 * Production Scheduler - Fixed Implementation
 * Uses existing CSS structure and StorageService API
 */
class Scheduler {
    constructor() {
        const globalDebug = (typeof window !== 'undefined' && window.DEBUG === true);
        this.DEBUG = !!globalDebug;
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
        this.bindElements();
        this.attachEventListeners();
        this.loadTasks();
        this.renderCalendar();
        this.updateDateDisplay();
    }
    
    bindElements() {
        this.elements = {
            taskPool: document.getElementById('taskPool'),
            calendarContainer: document.getElementById('calendarContainer'),
            currentDate: document.getElementById('currentDate'),
            todayBtn: document.getElementById('todayBtn'),
            prevDay: document.getElementById('prevDay'),
            nextDay: document.getElementById('nextDay'),
            messageContainer: document.getElementById('messageContainer')
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
    
    attachEventListeners() {
        this.elements.todayBtn.addEventListener('click', () => this.goToToday());
        this.elements.prevDay.addEventListener('click', () => this.previousDay());
        this.elements.nextDay.addEventListener('click', () => this.nextDay());
        
        // Setup task pool drop zone
        this.setupTaskPoolDropZone();
        
        // Listen for machine availability changes
        window.addEventListener('machineAvailabilityChanged', () => {
            this.refreshCalendar();
        });
    }
    
    setupTaskPoolDropZone() {
        const taskPool = this.elements.taskPool;
        
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
                this.unscheduleEvent(eventId);
            }
        });
    }
    
    loadTasks() {
        const taskPool = this.elements.taskPool;
        
        // Clear the task pool completely
        taskPool.innerHTML = '';
        
        // Get available tasks (ODP orders that aren't scheduled)
        const allOrders = this.storageService.getODPOrders();
        const scheduledEvents = this.storageService.getScheduledEvents();
        const scheduledTaskIds = new Set(scheduledEvents.map(event => event.taskId));
        
        const availableTasks = allOrders.filter(order => !scheduledTaskIds.has(order.id));
        
        if (availableTasks.length === 0) {
            taskPool.innerHTML = '<div class="empty-state">No tasks available for scheduling</div>';
            return;
        }
        
        availableTasks.forEach(task => {
            this.createTaskElement(task);
        });
    }
    
    createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.draggable = true;
        taskElement.dataset.taskId = task.id;
        taskElement.style.background = this.getTaskColor(task);
        
        const duration = this.getTaskDuration(task);
        
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
        
        this.elements.taskPool.appendChild(taskElement);
    }
    
    renderCalendar() {
        // Get only active machines for scheduling
        const allMachines = this.storageService.getMachines();
        if (this.DEBUG) console.log('🔍 Scheduler Debug - All machines:', allMachines);
        
        const activeMachines = this.getActiveMachines(allMachines);
        if (this.DEBUG) console.log('🔍 Scheduler Debug - Active machines:', activeMachines);
        
        const calendarContainer = this.elements.calendarContainer;
        calendarContainer.innerHTML = '';
        
        if (activeMachines.length === 0) {
            if (this.DEBUG) console.warn('⚠️ No active machines found for scheduling. All machines:', allMachines);
            calendarContainer.innerHTML = '<div class="empty-state">No active machines available for scheduling</div>';
            return;
        }
        
        // Create header
        this.createCalendarHeader(calendarContainer);
        
        // Create machine rows
        activeMachines.forEach(machine => {
            this.createMachineRow(machine, calendarContainer);
        });
        
        // Render scheduled events
        this.renderScheduledEvents();
    }
    
    /**
     * Refresh calendar to reflect machine availability changes
     */
    refreshCalendar() {
        this.renderCalendar();
    }

    /**
     * Get machines that are available for production scheduling
     * @param {Array} machines - All machines
     * @returns {Array} - Active machines only
     */
    getActiveMachines(machines) {
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
     * Get display name for machine
     * @param {Object} machine - Machine object
     * @returns {string} - Display name
     */
    getMachineDisplayName(machine) {
        return this.businessLogic.getMachineDisplayName(machine);
    }
    
    createCalendarHeader(container) {
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
    
    createMachineRow(machine, container) {
        const machineRow = document.createElement('div');
        machineRow.className = 'machine-row';
        
        // Use unified model field consistently
        const displayName = this.getMachineDisplayName(machine);
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
            timeSlot.dataset.machine = this.getMachineDisplayName(machine);
            
            // Check if this hour is unavailable for the machine
            const dateStr = this.formatDate(this.currentDate);
            const machineName = this.getMachineDisplayName(machine);
            const unavailableHours = this.storageService.getMachineAvailabilityForDate(machineName, dateStr);
            if (unavailableHours.includes(hour)) {
                timeSlot.classList.add('unavailable');
                timeSlot.style.pointerEvents = 'none'; // Disable drop zone for unavailable slots
                if (this.DEBUG) console.log(`🔍 Machine ${machineName} unavailable at ${hour}:00 on ${dateStr}`);
            }
            
            // Setup drop zone
            this.setupSlotDropZone(timeSlot);
            
            machineSlots.appendChild(timeSlot);
        }
        
        machineRow.appendChild(machineSlots);
        container.appendChild(machineRow);
    }
    
    setupSlotDropZone(slot) {
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
                        this.scheduleTask(taskId, taskData, slot);
                    } else {
                        console.warn('No task data found for task ID:', taskId);
                    }
                } catch (error) {
                    console.error('Error parsing task data:', error);
                    this.showMessage('Error scheduling task: Invalid data', 'error');
                }
            } else if (taskId && this.dragState.dragType === 'event') {
                // Handle moving existing events (rescheduling)
                this.rescheduleEvent(taskId, slot);
            }
        });
    }
    
    scheduleTask(taskId, taskData, slot) {
        const machine = slot.dataset.machine;
        const hour = parseInt(slot.dataset.hour);
        const duration = this.getTaskDuration(taskData);
        
        // Create event
        const event = {
            id: `${taskId}-${Date.now()}`,
            taskId: taskId,
            taskTitle: taskData.odp_number || taskData.name || 'Unknown Task',
            machine: machine,
            date: this.formatDate(this.currentDate),
            startHour: hour,
            endHour: hour + duration,
            color: this.getTaskColor(taskData),
            duration: duration
        };
        
        // Validate scheduling
        if (!this.canScheduleTask(machine, hour, duration)) {
            this.showMessage('Cannot schedule task at this time', 'error');
            return;
        }
        
        try {
            this.storageService.addScheduledEvent(event);
            this.showMessage(`Task scheduled successfully on ${machine}`, 'success');
            this.refreshScheduler();
        } catch (error) {
            this.showMessage('Failed to schedule task', 'error');
        }
    }
    
    unscheduleEvent(eventId) {
        try {
            this.storageService.removeScheduledEvent(eventId);
            this.showMessage('Task unscheduled successfully', 'success');
                this.refreshScheduler();
        } catch (error) {
            this.showMessage('Failed to unschedule task', 'error');
        }
    }
    
    rescheduleEvent(eventId, newSlot) {
        try {
            // Get the existing event
            const existingEvents = this.storageService.getScheduledEvents();
            const existingEvent = existingEvents.find(event => event.id === eventId);
            
            if (!existingEvent) {
                this.showMessage('Event not found', 'error');
                return;
            }
            
            // Calculate new position
            const newMachine = newSlot.dataset.machine;
            const newHour = parseInt(newSlot.dataset.hour);
            const duration = existingEvent.duration || 1;
            
            // Check if the new position is valid
            if (!this.canScheduleTask(newMachine, newHour, duration, eventId)) {
                this.showMessage('Cannot reschedule task to this time slot', 'error');
                return;
            }
            
            // Remove the old event
            this.storageService.removeScheduledEvent(eventId);
            
            // Create the new event with updated position
            const newEvent = {
                ...existingEvent,
                machine: newMachine,
                date: this.formatDate(this.currentDate),
                startHour: newHour,
                endHour: newHour + duration
            };
            
            // Add the rescheduled event
            this.storageService.addScheduledEvent(newEvent);
            this.showMessage(`Task rescheduled successfully to ${newMachine}`, 'success');
            this.refreshScheduler();
            
        } catch (error) {
            console.error('Error rescheduling event:', error);
            this.showMessage('Failed to reschedule task', 'error');
        }
    }
    
    canScheduleTask(machine, startHour, duration, excludeEventId = null) {
        const endHour = startHour + duration;
        
        // Check if within working hours (0-24)
        if (startHour < 0 || endHour > 24) {
            return false;
        }
        
        // Check for conflicts with existing events
        const dateKey = this.formatDate(this.currentDate);
        const existingEvents = this.storageService.getEventsByDate(dateKey);
        
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
    
    getTaskColor(task) {
        if (task.tipo_lavorazione) {
            if (task.tipo_lavorazione === 'printing') {
                return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
            } else if (task.tipo_lavorazione === 'packaging') {
                return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            }
        }
        
        if (task.color) {
            return task.color;
        }
        
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    getTaskDuration(task) {
        let duration = 1;
        
        if (task.duration) {
            duration = parseFloat(task.duration);
        } else if (task.totalTime) {
            duration = parseFloat(task.totalTime);
        }
        
        if (isNaN(duration) || duration <= 0) {
            duration = 1;
        } else {
            duration = Math.round(duration * 10) / 10;
        }
        
        return duration;
    }
    
    renderScheduledEvents() {
        // Clear existing events
        this.elements.calendarContainer.querySelectorAll('.scheduled-event').forEach(el => el.remove());
        
        const dateKey = this.formatDate(this.currentDate);
        const events = this.storageService.getEventsByDate(dateKey);
        
        events.forEach(event => {
            this.renderEvent(event);
        });
    }
    
    renderEvent(event) {
        const machineRow = this.elements.calendarContainer.querySelector(`[data-machine="${event.machine}"]`);
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
    
    formatDate(date) {
        return Utils.formatDate(date);
    }
    
    showMessage(message, type) {
        const messageEl = this.elements.messageContainer;
        
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
    
    goToToday() {
        this.currentDate = new Date();
        this.currentDate.setHours(0, 0, 0, 0);
        this.updateDateDisplay();
        this.renderCalendar();
    }
    
    previousDay() {
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        this.updateDateDisplay();
        this.renderCalendar();
    }
    
    nextDay() {
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.updateDateDisplay();
        this.renderCalendar();
    }
    
    updateDateDisplay() {
        if (this.elements.currentDate) {
            const today = new Date();
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
    }
    
    refreshScheduler() {
        this.loadTasks();
        this.renderCalendar();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the scheduler page
    if (document.getElementById('calendarContainer')) {
        window.scheduler = new Scheduler();
        
        // Listen for storage changes to refresh scheduler
        window.addEventListener('storage', (e) => {
            if (e.key === 'backlogTasks' || e.key === 'scheduledEvents' || e.key === 'schedulerMachines') {
                window.scheduler.refreshScheduler();
            }
        });
        
        // Listen for data change events for real-time updates
        window.addEventListener('dataChange', (e) => {
            const { dataType, action } = e.detail;
            
            if (dataType === 'machines' || dataType === 'tasks') {
                if (window.scheduler) {
                    window.scheduler.refreshScheduler();
                }
            }
        });
    }
});
