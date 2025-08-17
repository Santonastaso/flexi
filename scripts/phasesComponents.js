/**
 * Phases Components
 * 
 * Reusable components for the phases manager that replace manual DOM manipulation
 * with declarative, maintainable component templates.
 */

import { componentSystem } from './componentSystem.js';

// ===== PHASE ROW COMPONENT =====
componentSystem.registerComponent('phases-phase-row', (data) => {
    const { phase, editManager } = data;
    const createdDate = phase.created_at ? new Date(phase.created_at).toLocaleDateString() : '-';
    const updatedDate = phase.updated_at ? new Date(phase.updated_at).toLocaleDateString() : '-';
    
    return `
        <tr data-phase-id="${phase.id}">
            <td class="editable-cell" data-field="id">
                <span class="static-value">${phase.id}</span>
                ${editManager.create_edit_input('text', phase.id)}
            </td>
            <td class="editable-cell" data-field="name">
                <span class="static-value">${phase.name || '-'}</span>
                ${editManager.create_edit_input('text', phase.name)}
            </td>
            <td class="editable-cell" data-field="department">
                <span class="static-value">
                    <span class="btn btn-primary" style="font-size:12px;padding:6px 12px;min-height:28px;">
                        ${phase.department || '-'}
                    </span>
                </span>
                ${editManager.create_edit_input('select', phase.department, {
                    options: [
                        { value: 'STAMPA', label: 'STAMPA' },
                        { value: 'CONFEZIONAMENTO', label: 'CONFEZIONAMENTO' }
                    ]
                })}
            </td>
            <td class="editable-cell" data-field="work_center">
                <span class="static-value">${phase.work_center || '-'}</span>
                ${editManager.create_edit_input('select', phase.work_center, {
                    options: [
                        { value: 'ZANICA', label: 'ZANICA' },
                        { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
                    ]
                })}
            </td>
            <td class="editable-cell" data-field="v_stampa">
                <span class="static-value">${phase.v_stampa || 0} mt/h</span>
                ${editManager.create_edit_input('number', phase.v_stampa || 0, { min: 0 })}
            </td>
            <td class="editable-cell" data-field="t_setup_stampa">
                <span class="static-value">${phase.t_setup_stampa || 0} h</span>
                ${editManager.create_edit_input('number', phase.t_setup_stampa || 0, { min: 0 })}
            </td>
            <td class="editable-cell" data-field="costo_h_stampa">
                <span class="static-value">€${phase.costo_h_stampa || 0}/h</span>
                ${editManager.create_edit_input('number', phase.costo_h_stampa || 0, { min: 0, step: 0.01 })}
            </td>
            <td class="editable-cell" data-field="v_conf">
                <span class="static-value">${phase.v_conf || 0} pz/h</span>
                ${editManager.create_edit_input('number', phase.v_conf || 0, { min: 0 })}
            </td>
            <td class="editable-cell" data-field="t_setup_conf">
                <span class="static-value">${phase.t_setup_conf || 0} h</span>
                ${editManager.create_edit_input('number', phase.t_setup_conf || 0, { min: 0 })}
            </td>
            <td class="editable-cell" data-field="costo_h_conf">
                <span class="static-value">€${phase.costo_h_conf || 0}/h</span>
                ${editManager.create_edit_input('number', phase.costo_h_conf || 0, { min: 0, step: 0.01 })}
            </td>
            <td class="editable-cell" data-field="contenuto_fase">
                <span class="static-value">${phase.contenuto_fase || '-'}</span>
                ${editManager.create_edit_input('text', phase.contenuto_fase)}
            </td>
            <td class="editable-cell" data-field="numero_persone">
                <span class="static-value">${phase.numero_persone || '-'}</span>
                ${editManager.create_edit_input('number', phase.numero_persone || 1, { min: 1 })}
            </td>
            <td class="editable-cell" data-field="created_at">
                <span class="static-value">${createdDate}</span>
                ${editManager.create_edit_input('datetime-local', phase.created_at)}
            </td>
            <td class="editable-cell" data-field="updated_at">
                <span class="static-value">${updatedDate}</span>
                ${editManager.create_edit_input('datetime-local', phase.updated_at)}
            </td>
            <td class="text-center">
                ${editManager.create_action_buttons()}
            </td>
        </tr>
    `;
});

// ===== PHASE FORM COMPONENT =====
componentSystem.registerComponent('phases-phase-form', (data) => {
    const { phase, editManager } = data;
    const isPrinting = phase?.department === 'STAMPA';
    const isPackaging = phase?.department === 'CONFEZIONAMENTO';
    
    return `
        <form id="phase_form" class="phase-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="phase_name">Phase Name</label>
                    <input type="text" id="phase_name" name="phase_name" class="form-control" 
                           value="${phase?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="phase_type">Department</label>
                    <select id="phase_type" name="phase_type" class="form-control" required>
                        <option value="">Select Department</option>
                        <option value="STAMPA" ${isPrinting ? 'selected' : ''}>STAMPA</option>
                        <option value="CONFEZIONAMENTO" ${isPackaging ? 'selected' : ''}>CONFEZIONAMENTO</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="phase_work_center">Work Center</label>
                    <select id="phase_work_center" name="phase_work_center" class="form-control" required>
                        <option value="">Select Work Center</option>
                        <option value="ZANICA" ${phase?.work_center === 'ZANICA' ? 'selected' : ''}>ZANICA</option>
                        <option value="BUSTO_GAROLFO" ${phase?.work_center === 'BUSTO_GAROLFO' ? 'selected' : ''}>BUSTO GAROLFO</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="numero_persone">Number of People</label>
                    <input type="number" id="numero_persone" name="numero_persone" class="form-control" 
                           value="${phase?.numero_persone || 1}" min="1" required>
                </div>
            </div>
            
            <!-- Printing Parameters Section -->
            <div id="printing_params" class="parameters-section" style="display: ${isPrinting ? 'block' : 'none'};">
                <h4>Printing Parameters</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="v_stampa">Printing Speed (mt/h)</label>
                        <input type="number" id="v_stampa" name="v_stampa" class="form-control" 
                               value="${phase?.v_stampa || 0}" min="0" step="0.1">
                    </div>
                    <div class="form-group">
                        <label for="t_setup_stampa">Setup Time (h)</label>
                        <input type="number" id="t_setup_stampa" name="t_setup_stampa" class="form-control" 
                               value="${phase?.t_setup_stampa || 0}" min="0" step="0.1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="costo_h_stampa">Hourly Cost (€/h)</label>
                        <input type="number" id="costo_h_stampa" name="costo_h_stampa" class="form-control" 
                               value="${phase?.costo_h_stampa || 0}" min="0" step="0.01">
                    </div>
                </div>
            </div>
            
            <!-- Packaging Parameters Section -->
            <div id="packaging_params" class="parameters-section" style="display: ${isPackaging ? 'block' : 'none'};">
                <h4>Packaging Parameters</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="v_conf">Packaging Speed (pz/h)</label>
                        <input type="number" id="v_conf" name="v_conf" class="form-control" 
                               value="${phase?.v_conf || 0}" min="0" step="0.1">
                    </div>
                    <div class="form-group">
                        <label for="t_setup_conf">Setup Time (h)</label>
                        <input type="number" id="t_setup_conf" name="t_setup_conf" class="form-control" 
                               value="${phase?.t_setup_conf || 0}" min="0" step="0.1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="costo_h_conf">Hourly Cost (€/h)</label>
                        <input type="number" id="costo_h_conf" name="costo_h_conf" class="form-control" 
                               value="${phase?.costo_h_conf || 0}" min="0" step="0.01">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="contenuto_fase">Phase Content</label>
                        <textarea id="contenuto_fase" name="contenuto_fase" class="form-control" rows="3"
                                  placeholder="Describe the packaging phase content...">${phase?.contenuto_fase || ''}</textarea>
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" id="add_phase_btn" class="btn btn-primary">
                    ${phase ? 'Update Phase' : 'Add Phase'}
                </button>
                <button type="button" class="btn btn-secondary" data-action="clearForm">Clear Form</button>
            </div>
        </form>
    `;
});

// ===== PHASE TYPE SELECT COMPONENT =====
componentSystem.registerComponent('phase-type-select', (data) => `
    <select id="phase_type" name="phase_type" class="form-control" required>
        <option value="">Select Department</option>
        <option value="STAMPA" ${data.selected === 'STAMPA' ? 'selected' : ''}>STAMPA</option>
        <option value="CONFEZIONAMENTO" ${data.selected === 'CONFEZIONAMENTO' ? 'selected' : ''}>CONFEZIONAMENTO</option>
    </select>
`);

// ===== WORK CENTER SELECT COMPONENT =====
componentSystem.registerComponent('phase-work-center-select', (data) => `
    <select id="phase_work_center" name="phase_work_center" class="form-control" required>
        <option value="">Select Work Center</option>
        <option value="ZANICA" ${data.selected === 'ZANICA' ? 'selected' : ''}>ZANICA</option>
        <option value="BUSTO_GAROLFO" ${data.selected === 'BUSTO_GAROLFO' ? 'selected' : ''}>BUSTO GAROLFO</option>
    </select>
`);

// ===== PRINTING PARAMETERS COMPONENT =====
componentSystem.registerComponent('printing-parameters', (data) => `
    <div id="printing_params" class="parameters-section" style="display: ${data.isVisible ? 'block' : 'none'};">
        <h4>Printing Parameters</h4>
        <div class="form-row">
            <div class="form-group">
                <label for="v_stampa">Printing Speed (mt/h)</label>
                <input type="number" id="v_stampa" name="v_stampa" class="form-control" 
                       value="${data.phase?.v_stampa || 0}" min="0" step="0.1">
            </div>
            <div class="form-group">
                <label for="t_setup_stampa">Setup Time (h)</label>
                <input type="number" id="t_setup_stampa" name="t_setup_stampa" class="form-control" 
                       value="${data.phase?.t_setup_stampa || 0}" min="0" step="0.1">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="costo_h_stampa">Hourly Cost (€/h)</label>
                <input type="number" id="costo_h_stampa" name="costo_h_stampa" class="form-control" 
                       value="${data.phase?.costo_h_stampa || 0}" min="0" step="0.01">
            </div>
        </div>
    </div>
`);

// ===== PACKAGING PARAMETERS COMPONENT =====
componentSystem.registerComponent('packaging-parameters', (data) => `
    <div id="packaging_params" class="parameters-section" style="display: ${data.isVisible ? 'block' : 'none'};">
        <h4>Packaging Parameters</h4>
        <div class="form-row">
            <div class="form-group">
                <label for="v_conf">Packaging Speed (pz/h)</label>
                <input type="number" id="v_conf" name="v_conf" class="form-control" 
                       value="${data.phase?.v_conf || 0}" min="0" step="0.1">
            </div>
            <div class="form-group">
                <label for="t_setup_conf">Setup Time (h)</label>
                <input type="number" id="t_setup_conf" name="t_setup_conf" class="form-control" 
                       value="${data.phase?.t_setup_conf || 0}" min="0" step="0.1">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="costo_h_conf">Hourly Cost (€/h)</label>
                <input type="number" id="costo_h_conf" name="costo_h_conf" class="form-control" 
                       value="${data.phase?.costo_h_conf || 0}" min="0" step="0.01">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="contenuto_fase">Phase Content</label>
                <textarea id="contenuto_fase" name="contenuto_fase" class="form-control" rows="3"
                          placeholder="Describe the packaging phase content...">${data.phase?.contenuto_fase || ''}</textarea>
            </div>
        </div>
    </div>
`);

// ===== EMPTY STATE COMPONENT =====
componentSystem.registerComponent('empty-state', (data) => `
    <tr>
        <td colspan="15" class="text-center" style="padding: 2rem; color: #6b7280;">
            ${data.message || 'No phases found. Add phases to get started.'}
        </td>
    </tr>
`);

// ===== LOADING STATE COMPONENT =====
componentSystem.registerComponent('loading-state', (data) => `
    <tr>
        <td colspan="15" class="text-center" style="padding: 2rem; color: #6b7280;">
            ${data.message || 'Loading...'}
        </td>
    </tr>
`);

// Export for use in phases-manager.js
export { componentSystem as phasesComponents };
