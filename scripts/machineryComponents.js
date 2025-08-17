/**
 * Machinery Components
 * 
 * Reusable components for the machinery manager that replace manual DOM manipulation
 * with declarative, maintainable component templates.
 */

import { componentSystem } from './componentSystem.js';

// ===== MACHINE ROW COMPONENT =====
componentSystem.registerComponent('machinery-machine-row', (data) => {
    const { machine, editManager } = data;
    const created_date = machine.created_at ? new Date(machine.created_at).toLocaleDateString() : '-';
    const updated_date = machine.updated_at ? new Date(machine.updated_at).toLocaleDateString() : '-';
    const display_name = machine.machine_name || machine.id || 'Unknown Machine';
    const is_active = machine.status === 'ACTIVE';
    
    // Create cell data for the template
    const cells = [
        { 
            field: 'machine_id', 
            content: `<strong>${machine.machine_id || machine.id}</strong>`, 
            input: editManager.create_edit_input('text', machine.machine_id || machine.id),
            className: 'editable-cell'
        },
        { 
            field: 'machine_type', 
            content: machine.machine_type || '-', 
            input: editManager.create_edit_input('select', machine.machine_type, { 
                options: [
                    { value: 'DIGITAL_PRINT', label: 'Digital Print' }, 
                    { value: 'FLEXO_PRINT', label: 'Flexo Print' }, 
                    { value: 'ROTOGRAVURE', label: 'Rotogravure' }, 
                    { value: 'PACKAGING', label: 'Packaging' }, 
                    { value: 'DOYPACK', label: 'Doypack' }
                ] 
            }),
            className: 'editable-cell'
        },
        { 
            field: 'machine_name', 
            content: display_name || '-', 
            input: editManager.create_edit_input('text', display_name),
            className: 'editable-cell'
        },
        { 
            field: 'work_center', 
            content: machine.work_center || '-', 
            input: editManager.create_edit_input('select', machine.work_center, { 
                options: [
                    { value: 'ZANICA', label: 'ZANICA' }, 
                    { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
                ] 
            }),
            className: 'editable-cell'
        },
        { 
            field: 'department', 
            content: `<span class="btn btn-primary" style="font-size:12px;padding:6px 12px;min-height:28px;">${machine.department || '-'}</span>`, 
            input: editManager.create_edit_input('select', machine.department, { 
                options: [
                    { value: 'STAMPA', label: 'STAMPA' }, 
                    { value: 'CONFEZIONAMENTO', label: 'CONFEZIONAMENTO' }
                ] 
            }),
            className: 'editable-cell'
        },
        { 
            field: 'status', 
            content: `<span class="status-badge status-active">${machine.status || 'ACTIVE'}</span>`, 
            input: editManager.create_edit_input('select', machine.status || 'ACTIVE', { 
                options: [
                    { value: 'ACTIVE', label: 'Active' }, 
                    { value: 'MAINTENANCE', label: 'Maintenance' }, 
                    { value: 'INACTIVE', label: 'Inactive' }
                ] 
            }),
            className: 'editable-cell'
        },
        { 
            field: 'min_web_width', 
            content: machine.min_web_width || 0, 
            input: editManager.create_edit_input('number', machine.min_web_width || 0, { min: 0 }),
            className: 'editable-cell'
        },
        { 
            field: 'max_web_width', 
            content: machine.max_web_width || 0, 
            input: editManager.create_edit_input('number', machine.max_web_width || 0, { min: 0 }),
            className: 'editable-cell'
        },
        { 
            field: 'min_bag_height', 
            content: machine.min_bag_height || 0, 
            input: editManager.create_edit_input('number', machine.min_bag_height || 0, { min: 0 }),
            className: 'editable-cell'
        },
        { 
            field: 'max_bag_height', 
            content: machine.max_bag_height || 0, 
            input: editManager.create_edit_input('number', machine.max_bag_height || 0, { min: 0 }),
            className: 'editable-cell'
        },
        { 
            field: 'standard_speed', 
            content: machine.standard_speed || 0, 
            input: editManager.create_edit_input('number', machine.standard_speed || 0, { min: 1 }),
            className: 'editable-cell'
        },
        { 
            field: 'setup_time_standard', 
            content: `${machine.setup_time_standard || 0} h`, 
            input: editManager.create_edit_input('number', machine.setup_time_standard || 0, { min: 0, step: 0.1 }),
            className: 'editable-cell'
        },
        { 
            field: 'changeover_color', 
            content: `${machine.changeover_color || 0} h`, 
            input: editManager.create_edit_input('number', machine.changeover_color || 0, { min: 0, step: 0.1 }),
            className: 'editable-cell'
        },
        { 
            field: 'changeover_material', 
            content: `${machine.changeover_material || 0} h`, 
            input: editManager.create_edit_input('number', machine.changeover_material || 0, { min: 0, step: 0.1 }),
            className: 'editable-cell'
        },
        { 
            field: 'active_shifts', 
            content: Array.isArray(machine.active_shifts) ? machine.active_shifts.join(', ') : machine.active_shifts || '-', 
            input: editManager.create_edit_input('shifts', machine.active_shifts),
            className: 'editable-cell'
        },
        { 
            field: 'created_at', 
            content: created_date, 
            input: editManager.create_edit_input('datetime-local', machine.created_at),
            className: 'editable-cell'
        },
        { 
            field: 'updated_at', 
            content: updated_date, 
            input: editManager.create_edit_input('datetime-local', machine.updated_at),
            className: 'editable-cell'
        },
        { 
            field: 'settings', 
            content: `<a href="machine-settings-page.html?machine=${encodeURIComponent(machine.machine_name)}" class="btn btn-secondary btn-small">📅</a>`, 
            input: '',
            className: 'text-center'
        },
        { 
            field: 'actions', 
            content: '', 
            input: editManager.create_action_buttons(),
            className: 'text-center'
        }
    ];

    return `
        <tr class="${!is_active ? 'machine-inactive' : ''}" data-machine-id="${machine.id}">
            ${cells.map(cell => `
                <td class="${cell.className}" data-field="${cell.field}">
                    ${cell.field === 'settings' || cell.field === 'actions' 
                        ? cell.content + cell.input
                        : `<span class="static-value">${cell.content}</span>${cell.input}`
                    }
                </td>
            `).join('')}
        </tr>
    `;
});

// ===== MACHINE TYPE SELECT COMPONENT =====
componentSystem.registerComponent('machinery-machine-type-select', (data) => `
    <select id="machine_type" name="machine_type" class="form-control" required>
        <option value="">Select machine type</option>
        <option value="DIGITAL_PRINT" ${data.selected === 'DIGITAL_PRINT' ? 'selected' : ''}>Digital Print</option>
        <option value="FLEXO_PRINT" ${data.selected === 'FLEXO_PRINT' ? 'selected' : ''}>Flexo Print</option>
        <option value="ROTOGRAVURE" ${data.selected === 'ROTOGRAVURE' ? 'selected' : ''}>Rotogravure</option>
        <option value="PACKAGING" ${data.selected === 'PACKAGING' ? 'selected' : ''}>Packaging</option>
        <option value="DOYPACK" ${data.selected === 'DOYPACK' ? 'selected' : ''}>Doypack</option>
    </select>
`);

// ===== WORK CENTER SELECT COMPONENT =====
componentSystem.registerComponent('machinery-work-center-select', (data) => `
    <select id="work_center" name="work_center" class="form-control" required>
        <option value="">Select work center</option>
        <option value="ZANICA" ${data.selected === 'ZANICA' ? 'selected' : ''}>ZANICA</option>
        <option value="BUSTO_GAROLFO" ${data.selected === 'BUSTO_GAROLFO' ? 'selected' : ''}>BUSTO GAROLFO</option>
    </select>
`);

// ===== DEPARTMENT SELECT COMPONENT =====
componentSystem.registerComponent('machinery-department-select', (data) => `
    <select id="department" name="department" class="form-control" required>
        <option value="">Select department</option>
        <option value="STAMPA" ${data.selected === 'STAMPA' ? 'selected' : ''}>STAMPA</option>
        <option value="CONFEZIONAMENTO" ${data.selected === 'CONFEZIONAMENTO' ? 'selected' : ''}>CONFEZIONAMENTO</option>
    </select>
`);

// ===== STATUS SELECT COMPONENT =====
componentSystem.registerComponent('machinery-status-select', (data) => `
    <select id="status" name="status" class="form-control" required>
        <option value="ACTIVE" ${data.selected === 'ACTIVE' ? 'selected' : ''}>Active</option>
        <option value="MAINTENANCE" ${data.selected === 'MAINTENANCE' ? 'selected' : ''}>Maintenance</option>
        <option value="INACTIVE" ${data.selected === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
    </select>
`);

// ===== MACHINE FORM COMPONENT =====
componentSystem.registerComponent('machinery-machine-form', (data) => `
    <form id="machine_form" class="machine-form">
        <div class="form-row">
            <div class="form-group">
                <label for="machine_id">Machine ID</label>
                <input type="text" id="machine_id" name="machine_id" class="form-control" value="${data.machine?.machine_id || ''}" required>
            </div>
            <div class="form-group">
                <label for="machine_name">Machine Name</label>
                <input type="text" id="machine_name" name="machine_name" class="form-control" value="${data.machine?.machine_name || ''}" required>
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="machine_type">Machine Type</label>
                ${componentSystem.render('machinery-machine-type-select', { selected: data.machine?.machine_type }).outerHTML}
            </div>
            <div class="form-group">
                <label for="work_center">Work Center</label>
                ${componentSystem.render('machinery-work-center-select', { selected: data.machine?.work_center }).outerHTML}
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="department">Department</label>
                ${componentSystem.render('machinery-department-select', { selected: data.machine?.department }).outerHTML}
            </div>
            <div class="form-group">
                <label for="status">Status</label>
                ${componentSystem.render('machinery-status-select', { selected: data.machine?.status || 'ACTIVE' }).outerHTML}
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="min_web_width">Min Web Width (mm)</label>
                <input type="number" id="min_web_width" name="min_web_width" class="form-control" value="${data.machine?.min_web_width || 0}" min="0">
            </div>
            <div class="form-group">
                <label for="max_web_width">Max Web Width (mm)</label>
                <input type="number" id="max_web_width" name="max_web_width" class="form-control" value="${data.machine?.max_web_width || 0}" min="0">
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="min_bag_height">Min Bag Height (mm)</label>
                <input type="number" id="min_bag_height" name="min_bag_height" class="form-control" value="${data.machine?.min_bag_height || 0}" min="0">
            </div>
            <div class="form-group">
                <label for="max_bag_height">Max Bag Height (mm)</label>
                <input type="number" id="max_bag_height" name="max_bag_height" class="form-control" value="${data.machine?.max_bag_height || 0}" min="0">
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="standard_speed">Standard Speed (m/min)</label>
                <input type="number" id="standard_speed" name="standard_speed" class="form-control" value="${data.machine?.standard_speed || 0}" min="1">
            </div>
            <div class="form-group">
                <label for="setup_time_standard">Setup Time Standard (h)</label>
                <input type="number" id="setup_time_standard" name="setup_time_standard" class="form-control" value="${data.machine?.setup_time_standard || 0}" min="0" step="0.1">
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="changeover_color">Color Changeover Time (h)</label>
                <input type="number" id="changeover_color" name="changeover_color" class="form-control" value="${data.machine?.changeover_color || 0}" min="0" step="0.1">
            </div>
            <div class="form-group">
                <label for="changeover_material">Material Changeover Time (h)</label>
                <input type="number" id="changeover_material" name="changeover_material" class="form-control" value="${data.machine?.changeover_material || 0}" min="0" step="0.1">
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">${data.machine ? 'Update Machine' : 'Add Machine'}</button>
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
        </div>
    </form>
`);

// ===== EMPTY STATE COMPONENT =====
componentSystem.registerComponent('empty-state', (data) => `
    <tr>
        <td colspan="22" class="text-center" style="padding: 2rem; color: #6b7280;">
            ${data.message || 'No machines available. Add machines to get started.'}
        </td>
    </tr>
`);

// ===== LOADING STATE COMPONENT =====
componentSystem.registerComponent('loading-state', (data) => `
    <tr>
        <td colspan="22" class="text-center" style="padding: 2rem; color: #6b7280;">
            ${data.message || 'Loading...'}
        </td>
    </tr>
`);

// Export for use in machinery-manager.js
export { componentSystem as machineryComponents };
