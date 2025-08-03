/**
 * Machinery Manager - Handles machine creation, editing, and management
 */
class MachineryManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.currentlyEditingIndex = null;
        this.init(this.getElementMap());
    }
    
    /**
     * Get element map for binding
     */
    getElementMap() {
        return {
            addMachineBtn: document.getElementById('addMachine'),
            machineNameInput: document.getElementById('machineName'),
            machineCityInput: document.getElementById('machineCity'),
            machineLiveInput: document.getElementById('machineLive'),
            machineryTableBody: document.getElementById('machinery-table-body')
        };
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.elements.addMachineBtn) return;
        
        // Add machine button
        this.elements.addMachineBtn.addEventListener('click', () => {
            this.handleAddMachine();
        });
        
        // Enter key on machine name input
        this.elements.machineNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAddMachine();
            }
        });
        
        // Table click events (delegation)
        this.elements.machineryTableBody.addEventListener('click', (e) => {
            this.handleTableClick(e, this.elements.machineryTableBody);
        });
    }
    
    /**
     * Handle adding a new machine
     */
    handleAddMachine() {
        try {
            const machineData = this.collectMachineData();
            const validationResult = this.validateMachineData(machineData);
            
            if (!validationResult.isValid) {
                this.showMessage(validationResult.message, 'error');
                return;
            }
            
            const machines = this.storageService.getMachines();
            machines.push(machineData);
            this.storageService.saveMachines(machines);
            
            this.clearForm();
            this.renderMachinery();
            
            this.showMessage('Machine added successfully!', 'success');
        } catch (error) {
            console.error('Error adding machine:', error);
            this.showMessage('Error adding machine. Please try again.', 'error');
        }
    }
    
    /**
     * Collect machine data from form inputs
     */
    collectMachineData() {
        return {
            name: this.elements.machineNameInput.value.trim(),
            city: this.elements.machineCityInput.value,
            live: this.elements.machineLiveInput.value === 'true'
        };
    }
    
    /**
     * Validate machine data
     */
    validateMachineData(machineData, excludeIndex = -1) {
        if (!machineData.name) {
            return {
                isValid: false,
                message: 'Please enter a machine name.'
            };
        }
        
        // Check for duplicate names
        const machines = this.storageService.getMachines();
        const isDuplicate = machines.some((machine, index) => {
            return index !== excludeIndex && 
                   machine.name.toLowerCase() === machineData.name.toLowerCase();
        });
        
        if (isDuplicate) {
            return {
                isValid: false,
                message: 'A machine with this name already exists.'
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Clear the form inputs
     */
    clearForm() {
        this.clearFormFields(['machineNameInput']);
        this.elements.machineCityInput.selectedIndex = 0;
        this.elements.machineLiveInput.selectedIndex = 0;
    }
    
    /**
     * Handle table click events
     */
    handleTableClick(e) {
        const targetButton = e.target.closest('button');
        if (!targetButton) return;
        
        const index = parseInt(targetButton.dataset.index);
        
        if (targetButton.classList.contains('edit-btn')) {
            this.handleEditMachine(index);
        } else if (targetButton.classList.contains('save-btn')) {
            this.handleSaveMachine(index);
        } else if (targetButton.classList.contains('delete-btn')) {
            this.handleDeleteMachine(index);
        }
    }
    
    /**
     * Handle editing a machine
     */
    handleEditMachine(index) {
        this.currentlyEditingIndex = index;
        this.renderMachinery();
    }
    
    /**
     * Handle saving machine changes
     */
    handleSaveMachine(index) {
        try {
            const newName = document.getElementById(`edit-name-${index}`).value.trim();
            const newCity = document.getElementById(`edit-city-${index}`).value;
            const newLive = document.getElementById(`edit-live-${index}`).value === 'true';
            
            const newMachineData = { name: newName, city: newCity, live: newLive };
            const validationResult = this.validateMachineData(newMachineData, index);
            
            if (!validationResult.isValid) {
                this.showMessage(validationResult.message, 'error');
                return;
            }
            
            const machines = this.storageService.getMachines();
            machines[index] = newMachineData;
            this.storageService.saveMachines(machines);
            
            this.currentlyEditingIndex = null;
            this.renderMachinery();
            
            this.showMessage('Machine updated successfully!', 'success');
        } catch (error) {
            console.error('Error saving machine:', error);
            this.showMessage('Error saving machine. Please try again.', 'error');
        }
    }
    
    /**
     * Handle deleting a machine
     */
    handleDeleteMachine(index) {
        try {
            const machines = this.storageService.getMachines();
            const machineToDelete = machines[index];
            if (!machineToDelete) {
                this.showMessage('Machine not found.', 'error');
                return;
            }
            UIComponents.confirm('Delete this machine?', () => {
                this.storageService.validateMachineCanBeDeleted(machineToDelete.name);
                machines.splice(index, 1);
                this.storageService.saveMachines(machines);
                this.renderMachinery();
                this.showMessage('Machine deleted.', 'success');
            });
        } catch (error) {
            console.error('Error deleting machine:', error);
            this.showMessage(error.message, 'error');
        }
    }
    
    /**
     * Render the machinery table
     */
    renderData() {
        this.renderMachinery();
    }
    
    /**
     * Render the machinery table
     */
    renderMachinery() {
        if (!this.elements.machineryTableBody) return;
        
        const machines = this.storageService.getMachines();
        this.elements.machineryTableBody.innerHTML = '';
        
        machines.forEach((machine, index) => {
            const row = this.createMachineRow(machine, index);
            this.elements.machineryTableBody.appendChild(row);
        });
    }
    
    /**
     * Create a table row for a machine
     */
    createMachineRow(machine, index) {
        const row = document.createElement('tr');
        const isEditing = index === this.currentlyEditingIndex;
        const isDisabled = this.currentlyEditingIndex !== null && !isEditing;
        const liveStatusClass = machine.live ? 'live' : 'not-live';
        
        if (isEditing) {
            row.innerHTML = this.createEditingRowHTML(machine, index);
        } else {
            row.innerHTML = this.createDisplayRowHTML(machine, index, isDisabled, liveStatusClass);
        }
        
        return row;
    }
    
    /**
     * Create HTML for editing row
     */
    createEditingRowHTML(machine, index) {
        return `
            <td>
                <input type="text" class="edit-input" value="${this.escapeHtml(machine.name)}" id="edit-name-${index}">
            </td>
            <td>
                <select class="edit-select" id="edit-city-${index}">
                    <option value="Milan" ${machine.city === 'Milan' ? 'selected' : ''}>Milan</option>
                    <option value="Tallinn" ${machine.city === 'Tallinn' ? 'selected' : ''}>Tallinn</option>
                </select>
            </td>
            <td>
                <select class="edit-select" id="edit-live-${index}">
                    <option value="true" ${machine.live ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!machine.live ? 'selected' : ''}>No</option>
                </select>
            </td>
            <td style="text-align: center;">
                <button class="action-btn" disabled>⚙️</button>
            </td>
            <td style="text-align: center;">
                <button class="action-btn save-btn" data-index="${index}" title="Save Changes">✓</button>
            </td>
            <td style="text-align: center;">
                <button class="action-btn delete" disabled>
                    ${this.getDeleteIcon()}
                </button>
            </td>
        `;
    }
    
    /**
     * Create HTML for display row
     */
    createDisplayRowHTML(machine, index, isDisabled, liveStatusClass) {
        const encodedName = encodeURIComponent(machine.name);
        const disabledAttrs = isDisabled ? 'disabled' : '';
        const linkDisabled = isDisabled ? 'onclick="return false;" style="pointer-events:none; color:#d1d5db;"' : '';
        
        return `
            <td>${this.escapeHtml(machine.name)}</td>
            <td>${this.escapeHtml(machine.city)}</td>
            <td>
                <span class="status-badge ${liveStatusClass}">
                    ${machine.live ? 'Yes' : 'No'}
                </span>
            </td>
            <td style="text-align: center;">
                <a href="machine_settings.html?machine=${encodedName}" 
                   class="action-btn" 
                   title="Edit Availability" 
                   ${linkDisabled}>⚙️</a>
            </td>
            <td style="text-align: center;">
                <button class="action-btn edit-btn" 
                        data-index="${index}" 
                        title="Edit Machine" 
                        ${disabledAttrs}>✏️</button>
            </td>
            <td style="text-align: center;">
                <button class="action-btn delete delete-btn" 
                        data-index="${index}" 
                        title="Delete Machine" 
                        ${disabledAttrs}>
                    ${this.getDeleteIcon()}
                </button>
            </td>
        `;
    }
    
    /**
     * Get delete icon SVG
     */
    getDeleteIcon() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09a2.09 2.09 0 00-2.09 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
        `;
    }
    

    
    /**
     * Public method to refresh the machinery display
     */
    refresh() {
        this.renderMachinery();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the machinery page
    if (document.getElementById('machinery-table-body')) {
        window.machineryManager = new MachineryManager();
    }
});