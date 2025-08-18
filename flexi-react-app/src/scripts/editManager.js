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

        // Add a single event listener for all actions using event delegation
        table.addEventListener('click', (e) => {
            const target = e.target;
            const row = target.closest('tr');
            if (!row) return; // Exit if the click was not on a button inside a row

            if (target.matches('.btn-edit')) {
                this.start_edit(row);
            } else if (target.matches('.btn-save')) {
                const handler = this.table_save_handlers.get(table);
                if (handler) {
                    handler(row);
                } else {
                    this.save_edit(row);
                }
            } else if (target.matches('.btn-cancel')) {
                this.cancel_edit(row);
            } else if (target.matches('.btn-delete')) {
                table.dispatchEvent(new CustomEvent('deleteRow', { detail: { row } }));
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
        row.querySelector('.edit-input, .edit-select')?.focus();

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
        row.querySelectorAll('.edit-input, .edit-select, .edit-color-container').forEach(el => el.style.display = 'none');
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
        const save_handler = this.table_save_handlers.get(table);
        if (table && typeof save_handler === 'function') {
            save_handler(row);
        }
    }


    /**
     * Collect edited values from a row
     */
    collect_edited_values(row) {
        const updated_data = {};
        row.querySelectorAll('.editable-cell[data-field]').forEach(cell => {
            const field = cell.dataset.field;
            
            // Skip readonly fields
            if (cell.dataset.readonly === 'true') {
                return;
            }
            
            const input = cell.querySelector('.edit-input, .edit-select');
            if (!input) return;

            if (field === 'active_shifts') {
                const checkboxes = cell.querySelectorAll('.edit-shift-checkbox');
                if (checkboxes.length > 0) {
                    updated_data[field] = Array.from(checkboxes)
                        .filter(cb => cb.checked)
                        .map(cb => cb.value);
                } else {
                    const value = input.value.trim();
                    updated_data[field] = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
                }
            } else {
                updated_data[field] = input.value;
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
                const shifts = Array.isArray(value) ? value : (value ? String(value).split(',').map(s => s.trim()) : []);
                return `
                    <div class="edit-shifts-container" style="display: none;">
                        ${['T1', 'T2', 'T3'].map(s => `
                            <label><input type="checkbox" class="edit-shift-checkbox" value="${s}" ${shifts.includes(s) ? 'checked' : ''}> ${s}</label>
                        `).join('')}
                    </div>
                `;
            case 'color':
                const color_options = [
                    { value: '#1a73e8', label: 'Blue' }, { value: '#34a853', label: 'Green' },
                    { value: '#ea4335', label: 'Red' }, { value: '#fbbc04', label: 'Yellow' },
                    { value: '#9c27b0', label: 'Purple' }, { value: '#ff9800', label: 'Orange' },
                    { value: '#00bcd4', label: 'Cyan' }, { value: '#e91e63', label: 'Pink' }
                ];
                const color_options_html = color_options.map(opt =>
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `
                    <div class="edit-color-container" style="display: none;">
                        <select class="edit-select" onchange="this.nextElementSibling.style.backgroundColor = this.value;">
                            ${color_options_html}
                        </select>
                        <div class="color-preview-edit" style="background-color: ${value || '#1a73e8'};"></div>
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
                <button class="btn-edit" title="Edit">Edit</button>
                <button class="btn-delete" title="Delete">Delete</button>
            </div>
            <div class="save-cancel-buttons" style="display: none;">
                <button class="btn-save" title="Save changes">Save</button>
                <button class="btn-cancel" title="Cancel edit">Cancel</button>
            </div>
        `;
    }
}

// Export as global singleton
export const editManager = new EditManager();