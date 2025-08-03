/**
 * New Backlog Manager - Handles printing and packaging production lots
 * Implements Italian calculation formulas for Stampa and Confezionamento
 */
class NewBacklogManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.editManager = window.editManager;
        this.currentCalculation = null;
        this.init();
    }

    init() {
        // Ensure storage service is available
        if (!this.storageService) {
            console.error('StorageService not available');
            return;
        }
        
        if (super.init(this.getElementMap())) {
            this.loadMachines();
            this.loadBacklog();
            this.setupFormValidation();
            
            // Initialize edit functionality
            if (this.editManager) {
                this.editManager.initTableEdit('.modern-table');
                // Override saveEdit method
                this.editManager.saveEdit = (row) => this.saveEdit(row);
                
                // Handle delete events
                const table = document.querySelector('.modern-table');
                if (table) {
                    table.addEventListener('deleteRow', (e) => {
                        console.log('DeleteRow event received:', e);
                        const row = e.detail.row;
                        const taskId = row.dataset.taskId;
                        if (taskId) {
                            console.log('Deleting task with ID:', taskId);
                            this.deleteTask(taskId);
                        }
                    });
                }
            } else {
                console.error('EditManager not available');
            }
        }
    }

    getElementMap() {
        return {
            // Form inputs
            taskName: document.getElementById('taskName'),
            numeroBuste: document.getElementById('numeroBuste'),
            passoBusta: document.getElementById('passoBusta'),
            altezzaBusta: document.getElementById('altezzaBusta'),
            fasciaBusta: document.getElementById('fasciaBusta'),
            pezziScatola: document.getElementById('pezziScatola'),
            includePrinting: document.getElementById('includePrinting'),
            includePackaging: document.getElementById('includePackaging'),
            taskColor: document.getElementById('taskColor'),
            printingMachine: document.getElementById('printingMachine'),
            packagingMachine: document.getElementById('packagingMachine'),
            
            // Buttons
            calculateBtn: document.getElementById('calculateBtn'),
            createTaskBtn: document.getElementById('createTask'),
            
            // Results
            calculationResults: document.getElementById('calculationResults'),
            linearMeters: document.getElementById('linearMeters'),
            printingTime: document.getElementById('printingTime'),
            printingCost: document.getElementById('printingCost'),
            packagingTime: document.getElementById('packagingTime'),
            packagingCost: document.getElementById('packagingCost'),
            totalTime: document.getElementById('totalTime'),
            totalCost: document.getElementById('totalCost'),
            
            // Table
            backlogTableBody: document.getElementById('backlog-table-body'),
            
            // Preview elements
            previewFascia: document.getElementById('previewFascia'),
            previewAltezza: document.getElementById('previewAltezza'),
            previewPasso: document.getElementById('previewPasso'),
            previewNumeroBuste: document.getElementById('previewNumeroBuste'),
            previewPezziScatola: document.getElementById('previewPezziScatola'),
            previewTotalBoxes: document.getElementById('previewTotalBoxes'),
            colorPreview: document.getElementById('colorPreview')
        };
    }

    attachEventListeners() {
        this.elements.calculateBtn.addEventListener('click', () => this.calculateProduction());
        this.elements.createTaskBtn.addEventListener('click', () => this.addToBacklog());
        
        // Auto-enable/disable machine selects based on checkboxes
        this.elements.includePrinting.addEventListener('change', () => this.updateMachineSelects());
        this.elements.includePackaging.addEventListener('change', () => this.updateMachineSelects());
        
        // Form validation and preview updates
        const inputs = [this.elements.numeroBuste, this.elements.passoBusta, this.elements.altezzaBusta, 
                       this.elements.fasciaBusta, this.elements.pezziScatola];
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateForm();
                this.updatePreview();
            });
        });
        
        // Color preview update
        this.elements.taskColor.addEventListener('change', () => this.updateColorPreview());
    }

    setupFormValidation() {
        this.validateForm();
        this.updateMachineSelects();
        this.updatePreview(); // Initial preview update
        this.updateColorPreview(); // Initial color preview
    }

    updateColorPreview() {
        const selectedColor = this.elements.taskColor.value;
        if (this.elements.colorPreview) {
            this.elements.colorPreview.style.backgroundColor = selectedColor;
        }
    }

    updatePreview() {
        // Get current form values
        const numeroBuste = this.elements.numeroBuste.value || '';
        const passoBusta = this.elements.passoBusta.value || '';
        const altezzaBusta = this.elements.altezzaBusta.value || '';
        const fasciaBusta = this.elements.fasciaBusta.value || '';
        const pezziScatola = this.elements.pezziScatola.value || '';
        
        // Update SVG labels
        this.elements.previewFascia.textContent = fasciaBusta ? `${fasciaBusta}mm` : '-';
        this.elements.previewAltezza.textContent = altezzaBusta ? `${altezzaBusta}mm` : '-';
        this.elements.previewPasso.textContent = passoBusta ? `${passoBusta}mm` : '-';
        
        // Update detail values
        this.elements.previewNumeroBuste.textContent = numeroBuste || '-';
        this.elements.previewPezziScatola.textContent = pezziScatola || '-';
        
        // Calculate and show total boxes
        if (numeroBuste && pezziScatola) {
            const totalBoxes = Math.ceil(parseInt(numeroBuste) / parseInt(pezziScatola));
            this.elements.previewTotalBoxes.textContent = totalBoxes.toLocaleString();
        } else {
            this.elements.previewTotalBoxes.textContent = '-';
        }
    }

    validateForm() {
        const hasRequiredFields = this.elements.taskName.value.trim() &&
                                this.elements.numeroBuste.value &&
                                this.elements.passoBusta.value &&
                                this.elements.altezzaBusta.value &&
                                this.elements.fasciaBusta.value &&
                                this.elements.pezziScatola.value;
        
        const hasAtLeastOneProcess = this.elements.includePrinting.checked || this.elements.includePackaging.checked;
        
        this.elements.calculateBtn.disabled = !hasRequiredFields || !hasAtLeastOneProcess;
        this.elements.createTaskBtn.disabled = !hasRequiredFields || !hasAtLeastOneProcess || !this.currentCalculation;
    }

    updateMachineSelects() {
        this.elements.printingMachine.disabled = !this.elements.includePrinting.checked;
        this.elements.packagingMachine.disabled = !this.elements.includePackaging.checked;
        
        if (!this.elements.includePrinting.checked) {
            this.elements.printingMachine.value = '';
        }
        if (!this.elements.includePackaging.checked) {
            this.elements.packagingMachine.value = '';
        }
    }

    loadMachines() {
        const catalog = this.storageService.getMachineryCatalog();
        
        // Load printing machines
        const printingMachines = catalog.filter(m => m.type === 'printing');
        this.elements.printingMachine.innerHTML = '<option value="">Select printing type</option>' +
            printingMachines.map(m => `<option value="${m.id}">${m.name} (${m.speed} m/min)</option>`).join('');
        
        // Load packaging machines
        const packagingMachines = catalog.filter(m => m.type === 'packaging');
        this.elements.packagingMachine.innerHTML = '<option value="">Select packaging type</option>' +
            packagingMachines.map(m => `<option value="${m.id}">${m.name} (${m.speed} pkg/h)</option>`).join('');
    }

    calculateProduction() {
        const data = this.collectFormData();
        
        if (!this.validateCalculationData(data)) {
            return;
        }

        try {
            const calculation = this.performCalculations(data);
            this.displayResults(calculation);
            this.currentCalculation = calculation;
            this.elements.createTaskBtn.disabled = false;
        } catch (error) {
            this.showMessage('Calculation error: ' + error.message, 'error');
        }
    }

    collectFormData() {
        return {
            name: this.elements.taskName.value.trim(),
            numeroBuste: parseInt(this.elements.numeroBuste.value),
            passoBusta: parseInt(this.elements.passoBusta.value),
            altezzaBusta: parseInt(this.elements.altezzaBusta.value),
            fasciaBusta: parseInt(this.elements.fasciaBusta.value),
            pezziScatola: parseInt(this.elements.pezziScatola.value),
            includePrinting: this.elements.includePrinting.checked,
            includePackaging: this.elements.includePackaging.checked,
            printingMachineId: this.elements.printingMachine.value,
            packagingMachineId: this.elements.packagingMachine.value,
            color: this.elements.taskColor.value
        };
    }

    validateCalculationData(data) {
        if (data.includePrinting && !data.printingMachineId) {
            this.showMessage('Please select a printing machine', 'error');
            return false;
        }
        
        if (data.includePackaging && !data.packagingMachineId) {
            this.showMessage('Please select a packaging machine', 'error');
            return false;
        }
        
        return true;
    }

    performCalculations(data) {
        const catalog = this.storageService.getMachineryCatalog();
        const result = {
            linearMeters: 0,
            printing: { time: 0, cost: 0 },
            packaging: { time: 0, cost: 0 },
            total: { time: 0, cost: 0 }
        };

        // Calculate linear meters needed
        // Formula: mt Lineari Necessari = Numero Buste * Passo / 1000
        result.linearMeters = (data.numeroBuste * data.passoBusta) / 1000;

        // PRINTING CALCULATIONS (Stampa)
        if (data.includePrinting) {
            const printingMachine = catalog.find(m => m.id === data.printingMachineId);
            if (printingMachine) {
                // Tempo Stampa = mt Lineari Necessari / Velocità (converted to minutes)
                const printingTimeMinutes = result.linearMeters / printingMachine.speed;
                result.printing.time = printingTimeMinutes / 60; // Convert to hours
                
                // Setup time is already in hours
                const totalPrintingTime = result.printing.time + printingMachine.setupTime;
                
                // Costo Stampa = (Tempo Stampa + Tempo Attrezzaggio) * (Costo Orario Fase / 60) * employees
                const hourlyCost = printingMachine.employees * printingMachine.employeeCost;
                result.printing.cost = totalPrintingTime * hourlyCost;
                result.printing.totalTime = totalPrintingTime;
            }
        }

        // PACKAGING CALCULATIONS (Confezionamento)
        if (data.includePackaging) {
            const packagingMachine = catalog.find(m => m.id === data.packagingMachineId);
            if (packagingMachine) {
                // Ore di Lavorazione = Numero Buste / Velocità Oraria Fase
                result.packaging.time = data.numeroBuste / packagingMachine.speed;
                
                // Total time including setup
                const totalPackagingTime = result.packaging.time + packagingMachine.setupTime;
                
                // Costo Confezionamento = (Ore di Lavorazione + Tempo Attrezzaggio) * Costo Orario Fase
                const hourlyCost = packagingMachine.employees * packagingMachine.employeeCost;
                result.packaging.cost = totalPackagingTime * hourlyCost;
                result.packaging.totalTime = totalPackagingTime;
            }
        }

        // Calculate totals
        result.total.time = (result.printing.totalTime || 0) + (result.packaging.totalTime || 0);
        result.total.cost = result.printing.cost + result.packaging.cost;

        return result;
    }

    displayResults(calculation) {
        this.elements.linearMeters.textContent = `${calculation.linearMeters.toFixed(2)} m`;
        
        if (this.elements.includePrinting.checked) {
            this.elements.printingTime.textContent = `${calculation.printing.totalTime.toFixed(2)} h`;
            this.elements.printingCost.textContent = `€${calculation.printing.cost.toFixed(2)}`;
        } else {
            this.elements.printingTime.textContent = '-';
            this.elements.printingCost.textContent = '-';
        }
        
        if (this.elements.includePackaging.checked) {
            this.elements.packagingTime.textContent = `${calculation.packaging.totalTime.toFixed(2)} h`;
            this.elements.packagingCost.textContent = `€${calculation.packaging.cost.toFixed(2)}`;
        } else {
            this.elements.packagingTime.textContent = '-';
            this.elements.packagingCost.textContent = '-';
        }
        
        this.elements.totalTime.textContent = `${calculation.total.time.toFixed(2)} h`;
        this.elements.totalCost.textContent = `€${calculation.total.cost.toFixed(2)}`;
        
        this.elements.calculationResults.style.display = 'block';
    }

    addToBacklog() {
        if (!this.currentCalculation) {
            this.showMessage('Please calculate first', 'error');
            return;
        }

        const data = this.collectFormData();
        
        // Create tasks based on selected processes
        const tasks = [];
        
        if (data.includePrinting) {
            const printingMachine = this.storageService.getMachineryById(data.printingMachineId);
            tasks.push({
                name: `${data.name} - Printing`,
                type: 'printing',
                numeroBuste: data.numeroBuste,
                passoBusta: data.passoBusta,
                altezzaBusta: data.altezzaBusta,
                fasciaBusta: data.fasciaBusta,
                pezziScatola: data.pezziScatola,
                machineId: data.printingMachineId,
                machineName: printingMachine.name,
                totalTime: this.currentCalculation.printing.totalTime.toFixed(2),
                totalCost: this.currentCalculation.printing.cost.toFixed(2),
                color: data.color,
                linearMeters: this.currentCalculation.linearMeters.toFixed(2)
            });
        }
        
        if (data.includePackaging) {
            const packagingMachine = this.storageService.getMachineryById(data.packagingMachineId);
            tasks.push({
                name: `${data.name} - Packaging`,
                type: 'packaging',
                numeroBuste: data.numeroBuste,
                passoBusta: data.passoBusta,
                altezzaBusta: data.altezzaBusta,
                fasciaBusta: data.fasciaBusta,
                pezziScatola: data.pezziScatola,
                machineId: data.packagingMachineId,
                machineName: packagingMachine.name,
                totalTime: this.currentCalculation.packaging.totalTime.toFixed(2),
                totalCost: this.currentCalculation.packaging.cost.toFixed(2),
                color: data.color
            });
        }

        try {
            tasks.forEach(task => {
                this.storageService.addBacklogTaskWithSync(task);
            });
            
            this.showMessage(`Added ${tasks.length} task(s) to backlog`, 'success');
            this.clearForm();
            this.loadBacklog();
        } catch (error) {
            this.showMessage('Error adding to backlog: ' + error.message, 'error');
        }
    }

    clearForm() {
        this.clearFormFields();
        this.elements.calculationResults.style.display = 'none';
        this.elements.createTaskBtn.disabled = true;
        this.currentCalculation = null;
        this.validateForm();
        this.updatePreview(); // Reset preview
        this.updateColorPreview(); // Reset color preview
    }

    loadBacklog() {
        const tasks = this.storageService.getBacklogTasks();
        this.renderBacklog(tasks);
    }

    renderData() {
        this.loadBacklog();
    }

    renderBacklog(tasks) {
        if (!tasks || tasks.length === 0) {
            this.elements.backlogTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No tasks in backlog. Create production lots to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.backlogTableBody.innerHTML = tasks.map(task => 
            this.createTaskRow(task)
        ).join('');
    }

    createTaskRow(task) {
        return `
            <tr data-task-id="${task.id}">
                <td class="editable-cell" data-field="name">
                    <span class="static-value"><strong>${task.name}</strong></span>
                    ${this.editManager.createEditInput('text', task.name)}
                </td>
                <td class="editable-cell" data-field="type">
                    <span class="static-value">
                        <span class="badge ${task.type === 'printing' ? 'badge-blue' : 'badge-green'}">
                            ${task.type}
                        </span>
                    </span>
                    ${this.editManager.createEditInput('select', task.type, {
                        options: [
                            { value: 'printing', label: 'Printing' },
                            { value: 'packaging', label: 'Packaging' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="numeroBuste">
                    <span class="static-value">${task.numeroBuste || '-'}</span>
                    ${this.editManager.createEditInput('number', task.numeroBuste, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="totalTime">
                    <span class="static-value">${task.totalTime}h</span>
                    ${this.editManager.createEditInput('number', task.totalTime, { min: 0.1, step: 0.1 })}
                </td>
                <td class="editable-cell" data-field="totalCost">
                    <span class="static-value">€${task.totalCost}</span>
                    ${this.editManager.createEditInput('number', task.totalCost, { min: 0, step: 0.01 })}
                </td>
                <td class="editable-cell" data-field="color">
                    <span class="static-value">
                        <div class="color-indicator" style="background-color: ${task.color}; width: 20px; height: 20px; border-radius: 50%; display: inline-block;"></div>
                    </span>
                    ${this.editManager.createEditInput('color', task.color)}
                </td>
                <td class="text-center">
                    ${this.editManager.createActionButtons()}
                </td>
            </tr>
        `;
    }

    deleteTask(taskId) {
        console.log('deleteTask called with taskId:', taskId);
        const task = this.storageService.getTaskById(taskId);
        
        try {
            // Check if task can be deleted (not scheduled on Gantt)
            this.storageService.validateTaskCanBeDeleted(taskId);
            
            const message = task ? 
                `Are you sure you want to delete "${task.name}"? This action cannot be undone.` :
                'Are you sure you want to delete this task? This action cannot be undone.';
                
            showDeleteConfirmation(message, () => {
                try {
                    this.storageService.removeBacklogTaskWithSync(taskId);
                    this.loadBacklog();
                    this.showMessage('Task deleted successfully', 'success');
                } catch (error) {
                    this.showMessage('Error deleting task: ' + error.message, 'error');
                }
            });
        } catch (error) {
            // Task is scheduled - show specific error
            this.showMessage(error.message + ' Move the task back to the pool first.', 'error');
        }
    }

    toggleEdit(taskId) {
        const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
        if (!row) return;

        const isEditing = row.classList.contains('editing');
        
        if (isEditing) {
            this.cancelEdit(taskId);
        } else {
            this.startEdit(taskId);
        }
    }

    startEdit(taskId) {
        const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
        if (!row) return;

        // Store original values for cancel
        const originalData = {};
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const staticValue = cell.querySelector('.static-value');
            originalData[field] = staticValue.textContent.trim();
        });
        row.dataset.originalData = JSON.stringify(originalData);

        // Show edit mode
        row.classList.add('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'block');
        row.querySelector('.action-buttons').style.display = 'none';
        row.querySelector('.save-cancel-buttons').style.display = 'block';

        // Focus first input
        const firstInput = row.querySelector('.edit-input, .edit-select');
        if (firstInput) firstInput.focus();

        // Add keyboard event listeners
        row.querySelectorAll('.edit-input, .edit-select').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveEdit(taskId);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEdit(taskId);
                }
            });
        });
    }

    cancelEdit(taskId) {
        const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
        if (!row) return;

        // Restore original values
        const originalData = JSON.parse(row.dataset.originalData || '{}');
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const staticValue = cell.querySelector('.static-value');
            if (originalData[field]) {
                staticValue.textContent = originalData[field];
            }
        });

        // Hide edit mode
        row.classList.remove('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'none');
        row.querySelector('.action-buttons').style.display = 'block';
        row.querySelector('.save-cancel-buttons').style.display = 'none';
    }

    saveEdit(row) {
        const taskId = row.dataset.taskId;
        if (!taskId) {
            console.error('No task ID found in row');
            return;
        }

        // Collect edited values using the edit manager
        const updatedData = this.editManager.collectEditedValues(row);

        console.log('Collected updated data:', updatedData);

        // Validate data
        if (!updatedData.name || updatedData.name.trim() === '') {
            this.showMessage('Task name cannot be empty', 'error');
            return;
        }

        try {
            // Get current task
            const task = this.storageService.getTaskById(taskId);
            if (!task) {
                this.showMessage('Task not found', 'error');
                return;
            }

            // Update task with new values
            const updatedTask = {
                ...task,
                name: updatedData.name.trim(),
                type: updatedData.type,
                numeroBuste: parseInt(updatedData.numeroBuste) || task.numeroBuste,
                totalTime: parseFloat(updatedData.totalTime) || task.totalTime,
                totalCost: parseFloat(updatedData.totalCost) || task.totalCost,
                color: updatedData.color
            };

            console.log('Original task:', task);
            console.log('Updated task:', updatedTask);

            // Save updated task
            this.storageService.saveBacklogTasksWithSync(
                this.storageService.getBacklogTasks().map(t => 
                    String(t.id) === String(taskId) ? updatedTask : t
                )
            );

            // Exit edit mode
            this.editManager.cancelEdit(row);

            // Update display
            this.loadBacklog();
            this.showMessage('Task updated successfully', 'success');

        } catch (error) {
            this.showMessage('Error updating task: ' + error.message, 'error');
        }
    }


}

// Initialize when DOM is loaded and storage service is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for storage service to be available
    const initializeManager = () => {
        if (window.storageService) {
            window.newBacklogManager = new NewBacklogManager();
        } else {
            // If storage service not ready, wait a bit and try again
            setTimeout(initializeManager, 50);
        }
    };
    
    initializeManager();
});