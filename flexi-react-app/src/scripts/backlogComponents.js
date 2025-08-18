/**
 * Backlog Components
 * 
 * Reusable components for the backlog manager that replace manual DOM manipulation
 * with declarative, maintainable component templates.
 */

import { componentSystem } from './componentSystem.js';

// ===== BACKLOG ROW COMPONENT =====
componentSystem.registerComponent('backlog-row', (data) => {
    const { item, machineNameMap, editManager } = data;
    const machineName = machineNameMap.get(item.scheduled_machine_id) || '-';
    
    return `
        <tr class="backlog-row" data-odp-id="${item.id}">
            <!-- IDENTIFICAZIONE (Identification) -->
            <td class="editable-cell" data-field="id">
                <span class="static-value">${item.id}</span>
                ${editManager ? editManager.create_edit_input('text', item.id) : ''}
            </td>
            <td class="editable-cell" data-field="odp_number">
                <span class="static-value">${item.odp_number || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.odp_number) : ''}
            </td>
            <td class="editable-cell" data-field="article_code">
                <span class="static-value">${item.article_code || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.article_code) : ''}
            </td>
            <td class="editable-cell" data-field="production_lot">
                <span class="static-value">${item.production_lot || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.production_lot) : ''}
            </td>
            <td class="editable-cell" data-field="work_center">
                <span class="static-value">${item.work_center || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.work_center) : ''}
            </td>
            <td class="editable-cell" data-field="nome_cliente">
                <span class="static-value">${item.nome_cliente || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.nome_cliente) : ''}
            </td>
            <td class="editable-cell" data-field="description">
                <span class="static-value">${item.description || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.description) : ''}
            </td>
            
            <!-- SPECIFICHE TECNICHE (Technical Specifications) -->
            <td class="editable-cell" data-field="bag_height">
                <span class="static-value">${item.bag_height || '-'} mm</span>
                ${editManager ? editManager.create_edit_input('number', item.bag_height, { min: 0 }) : ''}
            </td>
            <td class="editable-cell" data-field="bag_width">
                <span class="static-value">${item.bag_width || '-'} mm</span>
                ${editManager ? editManager.create_edit_input('number', item.bag_width, { min: 0 }) : ''}
            </td>
            <td class="editable-cell" data-field="bag_step">
                <span class="static-value">${item.bag_step || '-'} mm</span>
                ${editManager ? editManager.create_edit_input('number', item.bag_step, { min: 0 }) : ''}
            </td>
            <td class="editable-cell" data-field="seal_sides">
                <span class="static-value">${item.seal_sides || '-'} sides</span>
                ${editManager ? editManager.create_edit_input('select', item.seal_sides, { options: [{ value: '3', label: '3 sides' }, { value: '4', label: '4 sides' }] }) : ''}
            </td>
            <td class="editable-cell" data-field="product_type">
                <span class="static-value">${item.product_type || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.product_type) : ''}
            </td>
            <td class="editable-cell" data-field="quantity">
                <span class="static-value">${item.quantity || '-'}</span>
                ${editManager ? editManager.create_edit_input('number', item.quantity, { min: 0 }) : ''}
            </td>
            <td class="editable-cell" data-field="quantity_completed">
                <span class="static-value">${item.quantity_completed || 0}</span>
                ${editManager ? editManager.create_edit_input('number', item.quantity_completed, { min: 0, max: item.quantity || 999999 }) : ''}
            </td>
            <td class="editable-cell" data-field="quantity_per_box">
                <span class="static-value">${item.quantity_per_box || '-'}</span>
                ${editManager ? editManager.create_edit_input('number', item.quantity_per_box, { min: 1 }) : ''}
            </td>
            <td class="editable-cell" data-field="n_boxes">
                <span class="static-value">${item.n_boxes || '-'}</span>
                <span class="text-muted" style="font-size: 11px;"> (computed)</span>
            </td>
            <td class="editable-cell" data-field="progress">
                <span class="static-value">${item.progress || 0}%</span>
                <span class="text-muted" style="font-size: 11px;"> (computed)</span>
            </td>
            <td class="editable-cell" data-field="time_remaining">
                <span class="static-value">${item.time_remaining || item.duration || '-'} h</span>
                <span class="text-muted" style="font-size: 11px;"> (computed)</span>
            </td>
            
            <!-- PIANIFICAZIONE (Planning) -->
            <td class="editable-cell" data-field="production_start">
                <span class="static-value">${item.scheduled_start_time ? this.format_production_start(item.scheduled_start_time) : (item.production_start ? this.format_production_start(item.production_start) : '-')}</span>
                ${editManager ? editManager.create_edit_input('datetime-local', item.production_start) : ''}
            </td>
            <td class="editable-cell" data-field="production_end">
                <span class="static-value">${item.scheduled_end_time ? this.format_production_end(item.scheduled_end_time) : (item.production_end ? this.format_production_end(item.production_end) : '-')}</span>
                ${editManager ? editManager.create_edit_input('datetime-local', item.production_end) : ''}
            </td>
            <td class="editable-cell" data-field="delivery_date">
                <span class="static-value">${item.delivery_date || '-'}</span>
                ${editManager ? editManager.create_edit_input('datetime-local', item.delivery_date) : ''}
            </td>
            
            <!-- DATI COMMERCIALI (Commercial Data) -->
            <td class="editable-cell" data-field="internal_customer_code">
                <span class="static-value">${item.internal_customer_code || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.internal_customer_code) : ''}
            </td>
            <td class="editable-cell" data-field="external_customer_code">
                <span class="static-value">${item.external_customer_code || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.external_customer_code) : ''}
            </td>
            <td class="editable-cell" data-field="customer_order_ref">
                <span class="static-value">${item.customer_order_ref || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.customer_order_ref) : ''}
            </td>
            
            <!-- DATI LAVORAZIONE (Processing Data) -->
            <td class="editable-cell" data-field="department">
                <span class="static-value">
                    <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                        ${item.department || '-'}
                    </span>
                </span>
                ${editManager ? editManager.create_edit_input('text', item.department) : ''}
            </td>
            <td class="editable-cell" data-field="fase">
                <span class="static-value">${item.fase || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.fase) : ''}
            </td>
            
            <!-- COLONNE DA CALCOLARE (Calculated Columns) -->
            <td class="editable-cell" data-field="duration">
                <span class="static-value">${item.duration || '-'} h</span>
                ${editManager ? editManager.create_edit_input('number', item.duration, { min: 0, step: 0.1 }) : ''}
            </td>
            <td class="editable-cell" data-field="cost">
                <span class="static-value">€${item.cost || '-'}</span>
                ${editManager ? editManager.create_edit_input('number', item.cost, { min: 0, step: 0.01 }) : ''}
            </td>
            <td class="editable-cell" data-field="progress_calculated">
                <span class="static-value">${item.progress || 0}%</span>
                <span class="text-muted" style="font-size: 11px;"> (computed)</span>
            </td>
            <td class="editable-cell" data-field="time_remaining_calculated">
                <span class="static-value">${item.time_remaining || item.duration || '-'} h</span>
                <span class="text-muted" style="font-size: 11px;"> (computed)</span>
            </td>
            
            <!-- Additional fields -->
            <td class="editable-cell" data-field="priority">
                <span class="static-value">${item.priority || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.priority) : ''}
            </td>
            <td class="editable-cell" data-field="status">
                <span class="static-value">${item.status || '-'}</span>
                ${editManager ? editManager.create_edit_input('text', item.status) : ''}
            </td>
            <td class="editable-cell" data-field="scheduled_machine" data-readonly="true">
                <span class="static-value">${machineName}</span>
            </td>
            <td class="text-center">
                ${editManager ? editManager.create_action_buttons() : ''}
            </td>
        </tr>
    `;
});

// ===== EMPTY STATE COMPONENT =====
componentSystem.registerComponent('empty-state', (data) => `
    <tr>
        <td colspan="38" class="text-center" style="padding: 2rem; color: #6b7280;">
            ${data.message || 'No backlog items found. Create production lots to get started.'}
        </td>
    </tr>
`);

// ===== LOADING STATE COMPONENT =====
componentSystem.registerComponent('loading-state', (data) => `
    <tr>
        <td colspan="38" class="text-center" style="padding: 2rem; color: #6b7280;">
            ${data.message || 'Loading...'}
        </td>
    </tr>
`);

// Export for use in backlog-manager.js
export { componentSystem as backlogComponents };
