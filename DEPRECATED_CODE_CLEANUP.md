# Deprecated Code Cleanup Summary
*Last Updated: Current Implementation*

This document summarizes all the deprecated code that was removed during the architecture refactoring to centralize business logic and validation.

## Overview

The cleanup removed **business logic from the storage layer** and **duplicate validation logic from managers**, moving everything to centralized services following proper separation of concerns.

## Removed from StorageService

### **1. Machine ID Generation Methods**
```javascript
// ❌ REMOVED: generateMachineId()
generateMachineId(machineType, workCenter) {
    const machines = this.getMachines();
    const prefix = this.getMachineTypePrefix(machineType);
    const workCenterCode = workCenter === 'ZANICA' ? 'ZAN' : 'BGF';
    // ... complex ID generation logic
}

// ❌ REMOVED: getMachineTypePrefix()
getMachineTypePrefix(machineType) {
    const prefixes = {
        'DIGITAL_PRINT': 'DIGI',
        'FLEXO_PRINT': 'FLEX',
        'ROTOGRAVURE': 'ROTO',
        'PACKAGING': 'PACK',
        'DOYPACK': 'DOYP'
    };
    return prefixes[machineType] || 'MACH';
}
```

**Replaced by**: `BusinessLogicService.generateMachineId()` and `getMachineTypePrefix()`

### **2. ODP Auto-Determination Logic**
```javascript
// ❌ REMOVED: Auto-determination in addODPOrder()
let autoWorkCenter = normalizedWorkCenter;
if (order.article_code && (order.article_code.startsWith('P05') || order.article_code.startsWith('ISP05'))) {
    autoWorkCenter = 'BUSTO_GAROLFO';
} else {
    autoWorkCenter = 'ZANICA';
}

let autoDepartment = normalizedDepartment;
if (order.article_code && order.article_code.startsWith('P0')) {
    autoDepartment = 'CONFEZIONAMENTO';
} else {
    autoDepartment = 'STAMPA';
}

const autoInternalCustomerCode = normalizedArticle;
```

**Replaced by**: `BusinessLogicService.autoDetermineWorkCenter()`, `autoDetermineDepartment()`, and `autoSetInternalCustomerCode()`

### **3. ODP Number Generation**
```javascript
// ❌ REMOVED: generateODPNumber()
generateODPNumber() {
    const orders = this.get_odp_orders();
    const existingNumbers = orders
        .map(o => o.odp_number)
        .filter(num => num && num.startsWith('OP'))
        .map(num => parseInt(num.substring(2)))
        .filter(num => !isNaN(num));
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `OP${nextNumber.toString().padStart(6, '0')}`;
}
```

**Replaced by**: `BusinessLogicService.generateODPNumber()`

## Removed from Utils.js

### **1. Machine Helper Methods**
```javascript
// ❌ REMOVED: getMachineDisplayName()
static getMachineDisplayName(machine) {
    return (machine && machine.machine_name) || 'Unknown Machine';
}

// ❌ REMOVED: isActiveMachine()
static isActiveMachine(machine) {
    if (!machine) return false;
    if (machine.status) return String(machine.status).toUpperCase() === 'ACTIVE';
    return !!machine.machine_name;
}
```

**Replaced by**: `BusinessLogicService` methods

### **2. Machine Compatibility Methods**
```javascript
// ❌ REMOVED: isCompatible()
static isCompatible(machine, odp) {
    // Complex compatibility checking logic
    const reasons = [];
    // ... extensive compatibility validation
    return {
        compatible: reasons.length === 0,
        reasons: reasons,
        score: reasons.length === 0 ? 100 : Math.max(0, 100 - (reasons.length * 25))
    };
}

// ❌ REMOVED: getCompatibilityStatus()
static getCompatibilityStatus(machine, odp) {
    const result = Utils.isCompatible(machine, odp);
    // ... status formatting logic
}
```

**Replaced by**: `BusinessLogicService.isMachineCompatible()` and `getMachineCompatibilityStatus()`

## Removed from Manager Classes

### **1. MachineryManager**
```javascript
// ❌ REMOVED: Static method wrappers
static isActiveMachine(machine) { return Utils.isActiveMachine(machine); }
static getMachineDisplayName(machine) { return Utils.getMachineDisplayName(machine); }

// ❌ REMOVED: Hardcoded machine type options
const optionsByDep = {
    'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
    'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU']
};

// ❌ REMOVED: Complex validation logic
validateFormFields() {
    const requiredFields = ['machineType', 'machineName', 'machineWorkCenter', 'machineDepartment', 'maxWebWidth', 'maxBagHeight'];
    // ... extensive validation logic
}
```

**Replaced by**: Service calls to `ValidationService.validateMachine()` and `BusinessLogicService.getValidMachineTypes()`

### **2. BacklogManager**
```javascript
// ❌ REMOVED: Complex status determination logic
autoDetermineStatus() {
    const scheduledEvents = this.storageService.getScheduledEvents();
    const scheduledEvent = scheduledEvents.find(event => {
        // Multiple field checking logic
        if (String(event.taskId) === String(odpNumber)) return true;
        if (event.taskTitle && String(event.taskTitle).includes(odpNumber)) return true;
        if (event.odp_number && String(event.odp_number) === String(odpNumber)) return true;
        return false;
    });
    // ... status setting logic
}

// ❌ REMOVED: Complex timestamp determination
getProductionStartTimestamp() {
    // ... extensive event finding and timestamp calculation logic
}
```

**Replaced by**: Service calls to `BusinessLogicService.determineODPStatus()` and `getProductionStartTimestamp()`

### **3. PhasesManager**
```javascript
// ❌ REMOVED: Complex validation logic
validatePhaseForm() {
    const baseFields = ['phaseName', 'phaseType', 'numeroPersone'];
    // ... extensive validation with department-specific logic
    if (this.elements.phaseType.value === 'STAMPA') {
        const printingFields = ['vStampa', 'tSetupStampa', 'costoHStampa'];
        // ... printing validation
    } else if (this.elements.phaseType.value === 'CONFEZIONAMENTO') {
        const packagingFields = ['vConf', 'tSetupConf', 'costoHConf'];
        // ... packaging validation
    }
}
```

**Replaced by**: Service calls to `ValidationService.validatePhase()`

## Updated Method Signatures

### **1. StorageService.addMachine()**
```javascript
// Before: Auto-generated machine_id
if (!newMachine.machine_id && newMachine.machine_type && newMachine.work_center) {
    newMachine.machine_id = this.generateMachineId(newMachine.machine_type, newMachine.work_center);
}

// After: Manager handles ID generation
// Machine ID will be generated by BusinessLogicService
// This is now handled by the manager layer
```

### **2. StorageService.addODPOrder()**
```javascript
// Before: Auto-determined values
work_center: autoWorkCenter,
department: autoDepartment,
internal_customer_code: autoInternalCustomerCode,

// After: Manager provides values
work_center: order.work_center || normalizedWorkCenter,
department: order.department || normalizedDepartment,
internal_customer_code: order.internal_customer_code || normalizedArticle,
```

## Benefits of Cleanup

### **1. Proper Separation of Concerns**
- **StorageService**: Only data persistence and retrieval
- **BusinessLogicService**: All business logic and calculations
- **ValidationService**: All validation rules and checks
- **Managers**: Only UI logic and coordination

### **2. Single Source of Truth**
- **Validation rules**: One place to update
- **Business logic**: One place to modify
- **No duplication**: Consistent behavior across the application

### **3. Easier Testing**
- **Services**: Can be unit tested independently
- **Managers**: Can be tested with mocked services
- **Clear boundaries**: Easy to identify what to test

### **4. Better Maintainability**
- **Change validation rule**: Update `ValidationService` only
- **Change business logic**: Update `BusinessLogicService` only
- **No hunting**: No more searching through multiple files

### **5. Future-Ready Architecture**
- **Database integration**: Only storage layer changes
- **API layer**: Services can call external APIs
- **Microservices**: Easy to extract services to separate modules

## Migration Notes

### **1. For Existing Code**
- **Replace Utils calls**: Use appropriate service methods
- **Update validation**: Use `ValidationService` methods
- **Update business logic**: Use `BusinessLogicService` methods

### **2. For New Features**
- **Always use services**: Never implement business logic in managers
- **Follow patterns**: Use the established service architecture
- **Keep managers thin**: Focus on UI coordination only

### **3. For Testing**
- **Mock services**: Test managers with mocked services
- **Test services independently**: Unit test business logic separately
- **Integration tests**: Test the full flow with real services

## Conclusion

The cleanup successfully:
- ✅ **Removed business logic from storage layer**
- ✅ **Eliminated duplicate validation code**
- ✅ **Centralized all business rules**
- ✅ **Established proper separation of concerns**
- ✅ **Created maintainable architecture**

The codebase is now **cleaner**, **more maintainable**, and **easier to extend** with new features.
