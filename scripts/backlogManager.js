/**
 * Backlog Manager - Handles task creation and management
 */
class BacklogManager {
    constructor() {
        this.storageService = window.storageService;
        this.elements = {};
        this.init();
    }
    
    /**
     * Initialize the backlog manager
     */
    init() {
        this.bindElements();
        this.attachEventListeners();
        this.renderBacklog();
    }
    
    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            createTaskBtn: document.getElementById('createTask'),
            taskNameInput: document.getElementById('taskName'),
            taskSetupInput: document.getElementById('taskSetup'),
            taskProductionInput: document.getElementById('taskProduction'),
            taskColorInput: document.getElementById('taskColor'),
            backlogTableBody: document.getElementById('backlog-table-body')
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
        if (!this.elements.createTaskBtn) return;
        
        // Create task button
        this.elements.createTaskBtn.addEventListener('click', () => {
            this.handleAddTask();
        });
        
        // Enter key on task name input
        this.elements.taskNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAddTask();
            }
        });
        
        // Table click events (delegation)
        this.elements.backlogTableBody.addEventListener('click', (e) => {
            this.handleTableClick(e);
        });
    }
    
    /**
     * Handle adding a new task
     */
    handleAddTask() {
        try {
            const taskData = this.collectTaskData();
            const validationResult = this.validateTaskData(taskData);
            
            if (!validationResult.isValid) {
                alert(validationResult.message);
                return;
            }
            
            const newTask = this.storageService.addBacklogTask(taskData);
            this.renderBacklog();
            this.clearForm();
            
            console.log('Task added successfully:', newTask);
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Error adding task. Please try again.');
        }
    }
    
    /**
     * Collect task data from form inputs
     */
    collectTaskData() {
        const name = this.elements.taskNameInput.value.trim();
        const setupHours = parseFloat(this.elements.taskSetupInput.value) || 0;
        const productionHours = parseFloat(this.elements.taskProductionInput.value) || 0;
        const color = this.elements.taskColorInput.value;
        const duration = setupHours + productionHours;
        
        return {
            name,
            setupHours,
            productionHours,
            duration,
            color
        };
    }
    
    /**
     * Validate task data
     */
    validateTaskData(taskData) {
        if (!taskData.name) {
            return {
                isValid: false,
                message: 'Please enter a task name.'
            };
        }
        
        if (taskData.duration <= 0) {
            return {
                isValid: false,
                message: 'Please enter a duration greater than zero.'
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Clear the form inputs
     */
    clearForm() {
        this.elements.taskNameInput.value = '';
        this.elements.taskSetupInput.value = '1';
        this.elements.taskProductionInput.value = '4';
        this.elements.taskColorInput.selectedIndex = 0;
    }
    
    /**
     * Handle table click events
     */
    handleTableClick(e) {
        const deleteBtn = e.target.closest('.action-btn');
        if (deleteBtn) {
            const index = parseInt(deleteBtn.dataset.index);
            this.handleDeleteTask(index);
        }
    }
    
    /**
     * Handle deleting a task
     */
    handleDeleteTask(index) {
        try {
            const tasks = this.storageService.getBacklogTasks();
            const taskToDelete = tasks[index];
            
            if (!taskToDelete) {
                console.error('Task not found at index:', index);
                return;
            }
            
            // Validate task can be deleted
            this.storageService.validateTaskCanBeDeleted(taskToDelete.id);
            
            // Remove task
            this.storageService.removeBacklogTask(taskToDelete.id);
            this.renderBacklog();
            
            console.log('Task deleted successfully:', taskToDelete.name);
        } catch (error) {
            console.error('Error deleting task:', error);
            alert(error.message);
        }
    }
    
    /**
     * Render the backlog table
     */
    renderBacklog() {
        if (!this.elements.backlogTableBody) return;
        
        const tasks = this.storageService.getBacklogTasks();
        this.elements.backlogTableBody.innerHTML = '';
        
        tasks.forEach((task, index) => {
            const row = this.createTaskRow(task, index);
            this.elements.backlogTableBody.appendChild(row);
        });
    }
    
    /**
     * Create a table row for a task
     */
    createTaskRow(task, index) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${this.escapeHtml(task.name)}</td>
            <td>${task.setupHours}</td>
            <td>${task.productionHours}</td>
            <td><strong>${task.duration}</strong></td>
            <td>
                <div style="width: 24px; height: 24px; background-color: ${task.color}; border-radius: 6px;"></div>
            </td>
            <td style="text-align: center;">
                <button class="action-btn" data-index="${index}" title="Delete Task">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09a2.09 2.09 0 00-2.09 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            </td>
        `;
        return row;
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Public method to refresh the backlog display
     */
    refresh() {
        this.renderBacklog();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the backlog page
    if (document.getElementById('backlog-table-body')) {
        window.backlogManager = new BacklogManager();
    }
});