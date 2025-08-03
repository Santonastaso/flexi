/**
 * Backlog Manager - Handles task creation and management
 */
class BacklogManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.init(this.getElementMap());
    }
    
    /**
     * Get element map for binding
     */
    getElementMap() {
        return {
            createTaskBtn: document.getElementById('createTask'),
            taskNameInput: document.getElementById('taskName'),
            taskSetupInput: document.getElementById('taskSetup'),
            taskProductionInput: document.getElementById('taskProduction'),
            taskColorInput: document.getElementById('taskColor'),
            backlogTableBody: document.getElementById('backlog-table-body')
        };
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
            this.handleTableClick(e, this.elements.backlogTableBody);
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
                this.showMessage(validationResult.message, 'error');
                return;
            }
            const newTask = this.storageService.addBacklogTask(taskData);
            this.renderBacklog();
            this.clearForm();
            this.showMessage('Task added successfully!', 'success');
        } catch (error) {
            console.error('Error adding task:', error);
            this.showMessage('Error adding task. Please try again.', 'error');
        }
    }
    
    /**
     * Collect task data from form inputs
     */
    collectTaskData() {
        // New: Task Name (free string) and Product Type (dropdown)
        const name = this.elements.taskNameInput.value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const products = this.storageService.getItem('productsCatalog', []);
        const productIdx = document.getElementById('taskProduct').value;
        let product = products[productIdx];
        if (!product) product = {};
        const meters = parseFloat(document.getElementById('taskMeters').value) || 0;
        const color = this.elements.taskColorInput.value;
        const workTime = product.speed ? (meters / product.speed) : 0;
        const setupTime = product.setupTime || 0;
        const totalTime = setupTime + workTime;
        const totalCost = totalTime * (product.employeesPerHour || 0) * (product.employeeCostPerHour || 0);
        return {
            name,
            description,
            productType: product.name || '',
            meters,
            color,
            workTime: workTime.toFixed(2),
            setupTime: setupTime.toFixed(2),
            totalTime: totalTime.toFixed(2),
            totalCost: totalCost.toFixed(2)
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
        this.clearFormFields(['taskNameInput']);
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
                this.showMessage('Task not found.', 'error');
                return;
            }
            UIComponents.confirm('Delete this task?', () => {
                this.storageService.validateTaskCanBeDeleted(taskToDelete.id);
                this.storageService.removeBacklogTask(taskToDelete.id);
                this.renderBacklog();
                this.showMessage('Task deleted.', 'success');
            });
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showMessage(error.message, 'error');
        }
    }
    
    /**
     * Render the backlog table
     */
    renderData() {
        this.renderBacklog();
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
            <td>${task.setupTime}</td>
            <td>${task.workTime}</td>
            <td>${task.totalTime}</td>
            <td><div style="width: 24px; height: 24px; background-color: ${task.color}; border-radius: 6px;"></div></td>
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