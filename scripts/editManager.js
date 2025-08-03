/**
 * Edit Manager - Provides consistent edit functionality across all tables
 */
class EditManager {
    constructor() {
        this.currentEditingRow = null;
    }

    /**
     * Initialize edit functionality for a table
     */
    initTableEdit(tableSelector) {
        const table = typeof tableSelector === 'string' ? document.querySelector(tableSelector) : tableSelector;
        if (!table) return;

        // Add event delegation for edit buttons
        table.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-edit')) {
                const row = e.target.closest('tr');
                if (row) {
                    this.startEdit(row);
                }
            } else if (e.target.classList.contains('btn-save')) {
                const row = e.target.closest('tr');
                if (row) {
                    this.saveEdit(row);
                }
            } else if (e.target.classList.contains('btn-cancel')) {
                const row = e.target.closest('tr');
                if (row) {
                    this.cancelEdit(row);
                }
            } else if (e.target.classList.contains('btn-delete')) {
                const row = e.target.closest('tr');
                if (row) {
                    // Trigger custom delete event
                    const deleteEvent = new CustomEvent('deleteRow', {
                        detail: { row: row }
                    });
                    table.dispatchEvent(deleteEvent);
                }
            }
        });
    }

    /**
     * Start editing a row
     */
    startEdit(row) {
        if (this.currentEditingRow && this.currentEditingRow !== row) {
            this.cancelEdit(this.currentEditingRow);
        }

        this.currentEditingRow = row;

        // Store original values
        const originalData = {};
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const staticValue = cell.querySelector('.static-value');
            if (staticValue) {
                originalData[field] = staticValue.textContent.trim();
            }
        });
        row.dataset.originalData = JSON.stringify(originalData);

        // Show edit mode
        row.classList.add('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'flex');
        row.querySelector('.action-buttons').style.display = 'none';
        row.querySelector('.save-cancel-buttons').style.display = 'flex';

        // Focus first input
        const firstInput = row.querySelector('.edit-input, .edit-select');
        if (firstInput) firstInput.focus();

        // Add keyboard event listeners
        row.querySelectorAll('.edit-input, .edit-select').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveEdit(row);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEdit(row);
                }
            });
        });
    }

    /**
     * Cancel editing a row
     */
    cancelEdit(row) {
        // Restore original values
        const originalData = JSON.parse(row.dataset.originalData || '{}');
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const staticValue = cell.querySelector('.static-value');
            if (staticValue && originalData[field]) {
                staticValue.textContent = originalData[field];
            }
        });

        // Hide edit mode
        row.classList.remove('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'none');
        row.querySelector('.action-buttons').style.display = 'flex';
        row.querySelector('.save-cancel-buttons').style.display = 'none';

        this.currentEditingRow = null;
    }

    /**
     * Save edits for a row (to be implemented by specific managers)
     */
    saveEdit(row) {
        // This should be overridden by specific managers
        console.warn('saveEdit should be implemented by specific managers');
    }

    /**
     * Collect edited values from a row
     */
    collectEditedValues(row) {
        const updatedData = {};
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const input = cell.querySelector('.edit-input, .edit-select');
            if (input) {
                if (field === 'color') {
                    // For color, get the value from the select element
                    const colorSelect = cell.querySelector('.edit-select');
                    updatedData[field] = colorSelect ? colorSelect.value : input.value;
                } else {
                    updatedData[field] = input.value;
                }
            }
        });
        return updatedData;
    }

    /**
     * Create edit input field
     */
    createEditInput(type, value, options = {}) {
        switch (type) {
            case 'text':
                return `<input type="text" class="edit-input" value="${value || ''}" style="display: none;">`;
            case 'number':
                return `<input type="number" class="edit-input" value="${value || ''}" min="${options.min || 0}" step="${options.step || 1}" style="display: none;">`;
            case 'select':
                const optionsHtml = options.options.map(opt => 
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `<select class="edit-select" style="display: none;">${optionsHtml}</select>`;
            case 'color':
                const colorOptions = [
                    { value: '#1a73e8', label: 'Blue' },
                    { value: '#34a853', label: 'Green' },
                    { value: '#ea4335', label: 'Red' },
                    { value: '#fbbc04', label: 'Yellow' },
                    { value: '#9c27b0', label: 'Purple' },
                    { value: '#ff9800', label: 'Orange' },
                    { value: '#00bcd4', label: 'Cyan' },
                    { value: '#e91e63', label: 'Pink' }
                ];
                const colorOptionsHtml = colorOptions.map(opt => 
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `
                    <div class="edit-color-container" style="display: none;">
                        <select class="edit-select" onchange="this.nextElementSibling.style.backgroundColor = this.value;">
                            ${colorOptionsHtml}
                        </select>
                        <div class="color-preview-edit" style="background-color: ${value || '#1a73e8'}; width: 20px; height: 20px; border-radius: 50%; display: inline-block; margin-left: 8px;"></div>
                    </div>
                `;
            default:
                return `<input type="text" class="edit-input" value="${value || ''}" style="display: none;">`;
        }
    }

    /**
     * Create action buttons
     */
    createActionButtons() {
        return `
            <div class="action-buttons">
                <button class="btn-edit" title="Edit" style="background: var(--primary-blue); color: white; padding: 8px 16px; border-radius: 28px; border: none; cursor: pointer; font-weight: 700; min-height: 36px;">
                    ✏️ Edit
                </button>
                <button class="btn-delete" title="Delete" style="background: var(--danger-red); color: white; padding: 8px 16px; border-radius: 28px; border: none; cursor: pointer; font-weight: 700; min-height: 36px;">
                    🗑️ Delete
                </button>
            </div>
            <div class="save-cancel-buttons" style="display: none;">
                <button class="btn-save" title="Save changes">
                    ✅
                </button>
                <button class="btn-cancel" title="Cancel edit">
                    ❌
                </button>
            </div>
        `;
    }
}

// Export as global singleton
const editManager = new EditManager();

// Make available globally
if (typeof window !== 'undefined') {
    window.editManager = editManager;
}