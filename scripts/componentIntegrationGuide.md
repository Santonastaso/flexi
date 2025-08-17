# Component Integration Guide

This guide provides step-by-step instructions for integrating the new component system into existing managers.

## Overview

The component system replaces manual DOM manipulation with declarative, reusable components. This improves:
- **Maintainability**: Centralized UI templates
- **Performance**: Smart DOM updates
- **Reusability**: Consistent UI patterns
- **Developer Experience**: Declarative templates

## Integration Steps

### 1. Import Components

Add the import statement at the top of each manager file:

```javascript
// For Scheduler
import { schedulerComponents } from './schedulerComponents.js';

// For Machinery
import { machineryComponents } from './machineryComponents.js';

// For Phases
import { phasesComponents } from './phasesComponents.js';
```

### 2. Replace Manual DOM Creation

#### Before (Manual DOM):
```javascript
_create_task_element(task) {
    const taskElement = this._createElement('div', { 
        className: 'task-item', 
        dataset: { taskId: task.id }
    });
    taskElement.draggable = true;
    taskElement.style.background = task.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    
    const workCenterInfo = task.work_center ? ` (${task.work_center})` : '';
    taskElement.innerHTML = `<span>${task.odp_number || 'Unknown Task'}${workCenterInfo}</span><span class="task-duration">${duration}h</span>`;
    
    // ... event listeners
    return taskElement;
}
```

#### After (Component-based):
```javascript
_create_task_element(task) {
    const duration = parseFloat(task.time_remaining) || parseFloat(task.duration) || 1;
    const taskData = {
        id: task.id,
        odp_number: task.odp_number,
        work_center: task.work_center,
        duration: duration,
        color: task.color
    };
    
    const taskElement = schedulerComponents.render('task-element', taskData);
    
    // Add event listeners
    taskElement.addEventListener('dragstart', (e) => this._start_drag(e, taskElement, 'task', task));
    taskElement.addEventListener('dragend', () => this._end_drag(taskElement));
    
    return taskElement;
}
```

### 3. Replace Table Row Creation

#### Before (Manual HTML):
```javascript
create_machine_row(machine) {
    const row = document.createElement('tr');
    row.className = !is_active ? 'machine-inactive' : '';
    row.dataset.machineId = machine.id;
    
    // Create each cell manually
    const cells = [/* ... cell definitions ... */];
    cells.forEach(cell => {
        const td = document.createElement('td');
        td.className = cell.className;
        td.dataset.field = cell.field;
        td.innerHTML = `<span class="static-value">${cell.content}</span>${cell.input}`;
        row.appendChild(td);
    });
    
    return row;
}
```

#### After (Component-based):
```javascript
create_machine_row(machine) {
    const rowData = {
        machine: machine,
        editManager: this.editManager
    };
    
    const rowElement = machineryComponents.render('machine-row', rowData);
    return rowElement;
}
```

### 4. Replace Container Updates

#### Before (innerHTML):
```javascript
render_machinery(machines) {
    if (machines.length === 0) {
        this.elements.machinery_table_body.innerHTML = `
            <tr><td colspan="22" class="text-center">No machines available...</td></tr>
        `;
        return;
    }
    
    this.elements.machinery_table_body.innerHTML = '';
    machines.forEach(machine => {
        const row = this.create_machine_row(machine);
        this.elements.machinery_table_body.appendChild(row);
    });
}
```

#### After (Component-based):
```javascript
render_machinery(machines) {
    if (machines.length === 0) {
        machineryComponents.updateContainer(
            this.elements.machinery_table_body,
            'empty-state',
            [{ message: 'No machines available. Add machines to get started.' }]
        );
        return;
    }
    
    machineryComponents.updateContainer(
        this.elements.machinery_table_body,
        'machine-row',
        machines.map(machine => ({ machine, editManager: this.editManager }))
    );
}
```

### 5. Handle Event Binding

Components automatically handle event binding for elements with `data-action` attributes:

```javascript
// In component template
<button data-action="deleteMachine" class="btn btn-danger">Delete</button>

// In manager options
const options = {
    onDeleteMachine: (data, event, element) => {
        this.delete_machine(data.id);
    }
};

// Render with event handlers
machineryComponents.render('machine-row', rowData, options);
```

## Component-Specific Integration

### Scheduler Components

#### Task Elements
- Replace `_create_task_element()` with `schedulerComponents.render('task-element', taskData)`
- Add drag event listeners after rendering

#### Machine Rows
- Replace `_create_machine_row()` with `schedulerComponents.render('machine-row', machineData)`
- Use `schedulerComponents.updateContainer()` for batch updates

#### Calendar Header
- Replace `_create_calendar_header()` with `schedulerComponents.render('calendar-header')`

### Machinery Components

#### Machine Rows
- Replace `create_machine_row()` with `machineryComponents.render('machine-row', rowData)`
- Pass `editManager` in the data object

#### Forms
- Replace form HTML with `machineryComponents.render('machine-form', formData)`
- Use individual select components for dropdowns

### Phases Components

#### Phase Rows
- Replace `create_phase_row()` with `phasesComponents.render('phase-row', rowData)`
- Pass `editManager` in the data object

#### Phase Forms
- Replace form HTML with `phasesComponents.render('phase-form', formData)`
- Use conditional rendering for department-specific parameters

## Performance Optimizations

### 1. Batch Updates
Use `updateContainer()` for multiple items instead of individual renders:

```javascript
// Good: Batch update
machineryComponents.updateContainer(
    this.elements.machinery_table_body,
    'machine-row',
    machines.map(machine => ({ machine, editManager: this.editManager }))
);

// Avoid: Individual renders
machines.forEach(machine => {
    const row = machineryComponents.render('machine-row', { machine, editManager: this.editManager });
    this.elements.machinery_table_body.appendChild(row);
});
```

### 2. Data Preparation
Prepare data once and reuse:

```javascript
// Good: Prepare data once
const rowDataArray = machines.map(machine => ({
    machine,
    editManager: this.editManager
}));

machineryComponents.updateContainer(
    this.elements.machinery_table_body,
    'machine-row',
    rowDataArray
);

// Avoid: Prepare data in loop
machineryComponents.updateContainer(
    this.elements.machinery_table_body,
    'machine-row',
    machines.map(machine => ({ machine, editManager: this.editManager }))
);
```

### 3. Component Caching
Cache frequently used components:

```javascript
// Cache empty state component
this.emptyStateComponent = machineryComponents.render('empty-state', {
    message: 'No machines available. Add machines to get started.'
});

// Reuse cached component
if (machines.length === 0) {
    this.elements.machinery_table_body.innerHTML = '';
    this.elements.machinery_table_body.appendChild(this.emptyStateComponent);
    return;
}
```

## Error Handling

### 1. Component Fallbacks
Always provide fallback methods:

```javascript
try {
    machineryComponents.updateContainer(
        this.elements.machinery_table_body,
        'machine-row',
        machines.map(machine => ({ machine, editManager: this.editManager }))
    );
} catch (error) {
    console.error('Component rendering failed, using fallback:', error);
    this._fallback_render_machinery(machines);
}
```

### 2. Validation
Validate component data before rendering:

```javascript
_create_task_element(task) {
    if (!task || !task.id) {
        console.error('Invalid task data:', task);
        return document.createElement('div'); // Fallback element
    }
    
    const taskData = {
        id: task.id,
        odp_number: task.odp_number || 'Unknown Task',
        work_center: task.work_center,
        duration: parseFloat(task.time_remaining) || parseFloat(task.duration) || 1,
        color: task.color
    };
    
    return schedulerComponents.render('task-element', taskData);
}
```

## Testing Components

### 1. Unit Testing
Test individual components:

```javascript
// Test component rendering
const taskElement = schedulerComponents.render('task-element', {
    id: 'test-123',
    odp_number: 'OP123456',
    duration: 2.5,
    color: '#ff0000'
});

expect(taskElement.querySelector('[data-task-id]')).toBeTruthy();
expect(taskElement.textContent).toContain('OP123456');
```

### 2. Integration Testing
Test component integration:

```javascript
// Test component in manager context
const manager = new MachineryManager();
const machine = { id: 'test-123', machine_name: 'Test Machine' };
const row = manager.create_machine_row(machine);

expect(row.tagName).toBe('TR');
expect(row.dataset.machineId).toBe('test-123');
```

## Migration Checklist

- [ ] Import component modules
- [ ] Replace manual DOM creation with component rendering
- [ ] Update container update methods
- [ ] Add event binding options
- [ ] Implement fallback methods
- [ ] Test component rendering
- [ ] Test event handling
- [ ] Performance validation
- [ ] Error handling validation

## Benefits After Integration

1. **Reduced Code Duplication**: Common UI patterns are centralized
2. **Improved Maintainability**: UI changes only require component updates
3. **Better Performance**: Smart DOM updates reduce unnecessary re-renders
4. **Consistent UI**: Standardized component behavior across the application
5. **Easier Testing**: Components can be tested in isolation
6. **Developer Productivity**: Declarative templates are easier to understand

## Next Steps

After completing the short-term integration:

1. **Medium-term**: Integrate components into Calendar Renderer
2. **Long-term**: Create component library documentation
3. **Ongoing**: Monitor performance and optimize as needed
4. **Team Training**: Ensure consistent component usage across the team
