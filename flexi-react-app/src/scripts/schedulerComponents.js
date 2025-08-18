/**
 * Scheduler Components
 * 
 * Reusable components for the scheduler that replace manual DOM manipulation
 * with declarative, maintainable component templates.
 */

import { componentSystem } from './componentSystem.js';

// ===== TASK ELEMENT COMPONENT =====
componentSystem.registerComponent('task-element', (data) => `
    <div class="task-item" 
         data-task-id="${data.id}" 
         draggable="true"
         style="background: ${data.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}"
         title="${data.work_center ? `Work Center: ${data.work_center}` : ''}">
        <span>${data.odp_number || 'Unknown Task'}${data.work_center ? ` (${data.work_center})` : ''}</span>
        <span class="task-duration">${data.duration}h</span>
    </div>
`);

// ===== MACHINE ROW COMPONENT =====
componentSystem.registerComponent('scheduler-machine-row', (data) => `
    <div class="machine-row" 
         data-machine="${data.machine.id}" 
         data-machine-name="${data.machine.machine_name}">
        <div class="machine-label">
            <div class="machine-name">${data.machine.machine_name}</div>
            <div class="machine-city">${data.machine.work_center || ''}</div>
        </div>
        <div class="machine-slots">
            ${data.slots.map(slot => `
                <div class="time-slot ${slot.isUnavailable ? 'unavailable' : ''}" 
                     data-hour="${slot.hour}" 
                     data-minute="${slot.minute}" 
                     data-machine="${data.machine.id}" 
                     data-machine-name="${data.machine.machine_name}" 
                     data-work-center="${data.machine.work_center}" 
                     data-unavailable="${slot.isUnavailable}"
                     title="${slot.isUnavailable ? `Machine unavailable from ${slot.hour}:00 to ${slot.hour + 1}:00` : ''}">
                    ${slot.isUnavailable ? '<span class="unavailable-indicator">X</span>' : ''}
                </div>
            `).join('')}
            ${data.scheduledEvents.map(event => `
                <div class="scheduled-event" 
                     data-event-id="${event.id}" 
                     data-task-id="${event.taskId}"
                     style="background: ${event.color}; left: ${event.position.left}%; width: ${event.position.width}%"
                     draggable="true">
                    ${event.taskTitle}
                </div>
            `).join('')}
        </div>
    </div>
`);

// ===== CALENDAR HEADER COMPONENT =====
componentSystem.registerComponent('calendar-header', (data) => `
    <div class="calendar-header-row">
        <div class="machine-label-header">Machines</div>
        <div class="time-header">
            ${Array.from({ length: 96 }, (_, slot) => {
                const minute = (slot % 4) * 15;
                const textContent = minute === 0 ? `${Math.floor(slot / 4)}`.padStart(2, '0') : '';
                return `<div class="time-slot-header">${textContent}</div>`;
            }).join('')}
        </div>
    </div>
`);

// ===== TIME SLOT COMPONENT =====
componentSystem.registerComponent('time-slot', (data) => `
    <div class="time-slot ${data.isUnavailable ? 'unavailable' : ''}" 
         data-hour="${data.hour}" 
         data-minute="${data.minute}" 
         data-machine="${data.machineId}" 
         data-machine-name="${data.machineName}" 
         data-work-center="${data.workCenter}" 
         data-unavailable="${data.isUnavailable}"
         title="${data.isUnavailable ? `Machine unavailable from ${data.hour}:00 to ${data.hour + 1}:00` : ''}">
        ${data.isUnavailable ? '<span class="unavailable-indicator">X</span>' : ''}
    </div>
`);

// ===== SCHEDULED EVENT COMPONENT =====
componentSystem.registerComponent('scheduled-event', (data) => `
    <div class="scheduled-event" 
         data-event-id="${data.id}" 
         data-task-id="${data.taskId}"
         style="background: ${data.color}; left: ${data.position.left}%; width: ${data.position.width}%"
         draggable="true">
        ${data.taskTitle}
    </div>
`);

// ===== TASK POOL COMPONENT =====
componentSystem.registerComponent('task-pool', (data) => `
    <div class="task-pool" id="task_pool">
        <h3>Task Pool</h3>
        <div class="task-list">
            ${data.tasks.length === 0 
                ? '<div class="empty-state">No tasks available</div>'
                : data.tasks.map(task => componentSystem.render('task-element', task).outerHTML).join('')
            }
        </div>
    </div>
`);

// ===== EMPTY STATE COMPONENT =====
componentSystem.registerComponent('empty-state', (data) => `
    <div class="empty-state">
        <div class="empty-icon">${data.icon || '📋'}</div>
        <div class="empty-message">${data.message}</div>
        ${data.detail ? `<div class="empty-detail">${data.detail}</div>` : ''}
    </div>
`);

// ===== LOADING STATE COMPONENT =====
componentSystem.registerComponent('loading-state', (data) => `
    <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-message">${data.message || 'Loading...'}</div>
    </div>
`);

// ===== FILTER CONTROLS COMPONENT =====
componentSystem.registerComponent('filter-controls', (data) => `
    <div class="calendar-controls">
        <div class="filter-section">
            <div class="filter-group">
                <label for="work_center_filter">Work Center:</label>
                <select id="work_center_filter" class="machine-filter">
                    <option value="">All Work Centers</option>
                    ${data.workCenters.map(wc => `<option value="${wc}">${wc}</option>`).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label for="department_filter">Department:</label>
                <select id="department_filter" class="machine-filter">
                    <option value="">All Departments</option>
                    ${data.departments.map(dept => `<option value="${dept}">${dept}</option>`).join('')}
                </select>
            </div>
            <button id="clear_filters_btn" class="btn btn-secondary" data-action="clearFilters">Clear Filters</button>
        </div>
    </div>
`);

// Export for use in scheduler.js
export { componentSystem as schedulerComponents };
