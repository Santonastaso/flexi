/**
 * Edit Manager - Provides consistent edit functionality across all tables
 */
class EditManager {
    constructor() {
        this.current_editing_row = null;
        this.table_save_handlers = new WeakMap();
    }

    /**
     * Initialize edit functionality for a table
     */
    init_table_edit(table_selector) {
        const table = typeof table_selector === 'string' ? document.querySelector(table_selector) : table_selector;
        if (!table) return;

        // Add event delegation for edit buttons
        table.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-edit')) {
                const row = e.target.closest('tr');
                if (row) {
                    this.start_edit(row);
                }
            } else if (e.target.classList.contains('btn-save')) {
                const row = e.target.closest('tr');
                if (row) {
                    const handler = this.table_save_handlers.get(table);
                    if (typeof handler === 'function') {
                        handler(row);
                    } else {
                        this.save_edit(row);
                    }
                }
            } else if (e.target.classList.contains('btn-cancel')) {
                const row = e.target.closest('tr');
                if (row) {
                    this.cancel_edit(row);
                }
            } else if (e.target.classList.contains('btn-delete')) {
                const row = e.target.closest('tr');
                if (row) {
                    // Trigger custom delete event
                    const delete_event = new CustomEvent('deleteRow', {
                        detail: { row: row }
                    });
                    table.dispatchEvent(delete_event);
                }
            }
        });
    }

    /**
     * Register a per-table save handler to avoid global overrides
     */
    register_save_handler(table_or_selector, handler) {
        const table = typeof table_or_selector === 'string' ? document.querySelector(table_or_selector) : table_or_selector;
        if (table && typeof handler === 'function') {
            this.table_save_handlers.set(table, handler);
        }
    }

    /**
     * Start editing a row
     */
    start_edit(row) {
        if (this.current_editing_row && this.current_editing_row !== row) {
            this.cancel_edit(this.current_editing_row);
        }

        this.current_editing_row = row;

        // Store original values
        const original_data = {};
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const static_value = cell.querySelector('.static-value');
            if (static_value) {
                original_data[field] = static_value.textContent.trim();
            }
        });
        row.dataset.originalData = JSON.stringify(original_data);

        // Show edit mode
        row.classList.add('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'flex');
        row.querySelector('.action-buttons').style.display = 'none';
        row.querySelector('.save-cancel-buttons').style.display = 'flex';

        // Focus first input
        const first_input = row.querySelector('.edit-input, .edit-select');
        if (first_input) first_input.focus();

        // Add keyboard event listeners
        row.querySelectorAll('.edit-input, .edit-select').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.save_edit(row);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancel_edit(row);
                }
            });
        });
    }

    /**
     * Cancel editing a row
     */
    cancel_edit(row) {
        // Restore original values
        const original_data = JSON.parse(row.dataset.originalData || '{}');
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const static_value = cell.querySelector('.static-value');
            if (static_value && original_data[field]) {
                static_value.textContent = original_data[field];
            }
        });

        // Hide edit mode
        row.classList.remove('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'none');
        row.querySelector('.action-buttons').style.display = 'flex';
        row.querySelector('.save-cancel-buttons').style.display = 'none';

        this.current_editing_row = null;
    }

    /**
     * Save edits for a row by calling the registered save handler
     */
    save_edit(row) {
        // Find the table this row belongs to
        const table = row.closest('table');
        if (table && this.table_save_handlers.has(table)) {
            const save_handler = this.table_save_handlers.get(table);
            if (typeof save_handler === 'function') {
                save_handler(row);
            }
        }
    }

    /**
     * Collect edited values from a row
     */
    collect_edited_values(row) {
        const updated_data = {};
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const input = cell.querySelector('.edit-input, .edit-select');
            if (input) {
                if (field === 'color') {
                    // For color, get the value from the select element
                    const color_select = cell.querySelector('.edit-select');
                    updated_data[field] = color_select ? color_select.value : input.value;
                } else if (field === 'active_shifts') {
                    // Handle active_shifts as an array - collect from shift checkboxes
                    const shift_checkboxes = cell.querySelectorAll('.edit-shift-checkbox');
                    if (shift_checkboxes.length > 0) {
                        updated_data[field] = Array.from(shift_checkboxes)
                            .filter(checkbox => checkbox.checked)
                            .map(checkbox => checkbox.value);
                    } else {
                        // Fallback to text input if checkboxes not found
                        const value = input.value.trim();
                        if (value) {
                            updated_data[field] = value.split(',').map(shift => shift.trim()).filter(shift => shift);
                        } else {
                            updated_data[field] = [];
                        }
                    }
                } else {
                    updated_data[field] = input.value;
                }
            }
        });
        return updated_data;
    }

    /**
     * Create edit input field
     */
    create_edit_input(type, value, options = {}) {
        switch (type) {
            case 'text':
                return `<input type="text" class="edit-input" value="${value || ''}" style="display: none;">`;
            case 'number':
                return `<input type="number" class="edit-input" value="${value || ''}" min="0" step="${options.step || 1}" style="display: none;">`;
            case 'select':
                const options_html = options.options.map(opt => 
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `<select class="edit-select" style="display: none;">${options_html}</select>`;
            case 'shifts':
                // Special case for active_shifts - create checkboxes for T1, T2, T3
                const shifts = Array.isArray(value) ? value : (value ? value.split(',').map(s => s.trim()) : []);
                return `
                    <div class="edit-shifts-container" style="display: none;">
                        <label><input type="checkbox" class="edit-shift-checkbox" value="T1" ${shifts.includes('T1') ? 'checked' : ''}> T1</label>
                        <label><input type="checkbox" class="edit-shift-checkbox" value="T2" ${shifts.includes('T2') ? 'checked' : ''}> T2</label>
                        <label><input type="checkbox" class="edit-shift-checkbox" value="T3" ${shifts.includes('T3') ? 'checked' : ''}> T3</label>
                    </div>
                `;
            case 'color':
                const color_options = [
                    { value: '#1a73e8', label: 'Blue' },
                    { value: '#34a853', label: 'Green' },
                    { value: '#ea4335', label: 'Red' },
                    { value: '#fbbc04', label: 'Yellow' },
                    { value: '#9c27b0', label: 'Purple' },
                    { value: '#ff9800', label: 'Orange' },
                    { value: '#00bcd4', label: 'Cyan' },
                    { value: '#e91e63', label: 'Pink' }
                ];
                const color_options_html = color_options.map(opt => 
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `
                    <div class="edit-color-container" style="display: none;">
                        <select class="edit-select" onchange="this.nextElementSibling.style.backgroundColor = this.value;">
                            ${color_options_html}
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
    create_action_buttons() {
        return `
            <div class="action-buttons">
                <button class="btn-edit" title="Edit">
                    Edit
                </button>
                <button class="btn-delete" title="Delete">
                    Delete
                </button>
            </div>
            <div class="save-cancel-buttons" style="display: none;">
                <button class="btn-save" title="Save changes">
                    Save
                </button>
                <button class="btn-cancel" title="Cancel edit">
                    Cancel
                </button>
            </div>
        `;
    }
}

// Export as global singleton
export const editManager = new EditManager();