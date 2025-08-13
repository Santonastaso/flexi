# Application Architecture Documentation
*Last Updated: Current Implementation*

## Overview

This document describes the new centralized architecture for the Flexi Production Suite, designed to address the architectural issues identified in the previous implementation.

## Architecture Problems Solved

### **1. Scattered Validation Logic**
- **Before**: Validation logic was duplicated across multiple manager files
- **After**: Centralized in `ValidationService` with single source of truth

### **2. Business Logic in Storage Layer**
- **Before**: `storageService.js` contained business logic like `generateMachineId()` and `autoDetermineWorkCenter()`
- **After**: Business logic moved to `BusinessLogicService`, storage layer is "dumb"

### **3. Inconsistent Status Calculation**
- **Before**: Status calculation logic scattered across managers with different implementations
- **After**: Centralized status calculation in `BusinessLogicService`

## New Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │  HTML Pages     │ │  CSS Styles     │ │  UI Components│ │
│  └─────────────────┘ └─────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    MANAGER LAYER                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │BacklogManager   │ │MachineryManager │ │PhasesManager  │ │
│  │(UI Logic)       │ │(UI Logic)       │ │(UI Logic)     │ │
│  └─────────────────┘ └─────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │ValidationService│ │BusinessLogic    │ │Utils          │ │
│  │(Business Rules) │ │Service          │ │(Helpers)      │ │
│  │                 │ │(Calculations)   │ │               │ │
│  └─────────────────┘ └─────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              StorageService                             │ │
│  │           (Data Persistence Only)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Service Layer Components

### **1. ValidationService**
**Purpose**: Single source of truth for all validation logic

**Key Methods**:
- `validateMachine(machineData)` - Validate machine data
- `validatePhase(phaseData)` - Validate phase data  
- `validateODP(odpData)` - Validate ODP data
- `validateMachineCompatibility(machine, odpData)` - Cross-entity validation

**Usage Example**:
```javascript
// In any manager
const validationService = new ValidationService();
const validation = validationService.validateMachine(machineData);

if (!validation.isValid) {
    validation.errors.forEach(error => {
        this.showValidationError(error);
    });
    return;
}
```

### **2. BusinessLogicService**
**Purpose**: Centralized business logic and calculations

**Key Methods**:
- `generateMachineId(machineType, workCenter)` - Machine ID generation
- `autoDetermineWorkCenter(articleCode)` - Work center determination
- `autoDetermineDepartment(articleCode)` - Department determination
- `determineODPStatus(odpNumber, scheduledEvents)` - Status calculation
- `calculateProductionDuration(phase, quantity, bagWidth, bagHeight)` - Duration calculation
- `calculateProductionCost(phase, duration)` - Cost calculation

**Usage Example**:
```javascript
// In any manager
const businessLogic = new BusinessLogicService();
const workCenter = businessLogic.autoDetermineWorkCenter(articleCode);
const status = businessLogic.determineODPStatus(odpNumber, scheduledEvents);
```

## Manager Layer Responsibilities

### **BacklogManager**
- **UI Logic**: Form handling, event listeners, display updates
- **Validation**: Uses `ValidationService.validateODP()`
- **Business Logic**: Uses `BusinessLogicService` for calculations
- **Storage**: Delegates to `StorageService` for data persistence

### **MachineryManager**
- **UI Logic**: Form handling, event listeners, display updates
- **Validation**: Uses `ValidationService.validateMachine()`
- **Business Logic**: Uses `BusinessLogicService` for ID generation
- **Storage**: Delegates to `StorageService` for data persistence

### **PhasesManager**
- **UI Logic**: Form handling, event listeners, display updates
- **Validation**: Uses `ValidationService.validatePhase()`
- **Business Logic**: Uses `BusinessLogicService` for data normalization
- **Storage**: Delegates to `StorageService` for data persistence

## Storage Layer Responsibilities

### **StorageService**
- **Data Persistence**: Save/load data to/from localStorage
- **Data Retrieval**: Query methods for getting data
- **Data Integrity**: Basic data structure validation
- **NO Business Logic**: Only data operations

## Migration Guide

### **Step 1: Update HTML Files**
Add new service scripts before existing scripts:
```html
<script src="../scripts/validationService.js"></script>
<script src="../scripts/businessLogicService.js"></script>
```

### **Step 2: Update Manager Classes**
Replace validation logic with service calls:
```javascript
// Before
validateFormFields() {
    // Complex validation logic here
}

// After
validateFormFields() {
    const validationService = new ValidationService();
    const validation = validationService.validateMachine(this.collectMachineData());
    
    if (!validation.isValid) {
        validation.errors.forEach(error => {
            this.showValidationError(error);
        });
    }
}
```

### **Step 3: Update Business Logic Calls**
Replace business logic with service calls:
```javascript
// Before
generateMachineId(machineType, workCenter) {
    // Complex ID generation logic
}

// After
const businessLogic = new BusinessLogicService();
const machineId = businessLogic.generateMachineId(machineType, workCenter);
```

### **Step 4: Clean Up Storage Service**
Remove business logic methods from `StorageService`:
- `generateMachineId()`
- `autoDetermineWorkCenter()`
- `autoDetermineDepartment()`
- Status calculation logic

## Benefits of New Architecture

### **1. Single Source of Truth**
- All validation rules in one place
- All business logic in one place
- Consistent behavior across the application

### **2. Easier Maintenance**
- Change validation rule → Update one file
- Change business logic → Update one file
- No more hunting through multiple managers

### **3. Better Testing**
- Services can be unit tested independently
- Mock services for testing managers
- Clear separation of concerns

### **4. Improved Code Quality**
- No more duplicate validation logic
- Consistent error messages
- Centralized business rules

### **5. Easier Debugging**
- Business logic issues → Check BusinessLogicService
- Validation issues → Check ValidationService
- Storage issues → Check StorageService

## Best Practices

### **1. Always Use Services**
```javascript
// ❌ Don't do this in managers
if (machineData.max_web_width <= 0) {
    errors.push('Invalid web width');
}

// ✅ Do this instead
const validation = validationService.validateMachine(machineData);
```

### **2. Keep Managers Thin**
```javascript
// ❌ Don't put business logic in managers
handleAddMachine() {
    // Complex business logic here
}

// ✅ Delegate to services
handleAddMachine() {
    const validation = validationService.validateMachine(machineData);
    if (!validation.isValid) return;
    
    const machineId = businessLogic.generateMachineId(machineType, workCenter);
    // ... rest of UI logic
}
```

### **3. Use Service Instances**
```javascript
// ✅ Create service instances in constructor
constructor() {
    this.validationService = new ValidationService();
    this.businessLogic = new BusinessLogicService();
}

// ✅ Use throughout the class
validateForm() {
    return this.validationService.validateMachine(data);
}
```

## Future Enhancements

### **1. Database Integration**
- Replace localStorage with proper database
- Services remain the same, only storage layer changes
- Business logic stays centralized

### **2. API Layer**
- Add REST API service layer
- Services can call external APIs
- Maintain same architecture

### **3. Caching Layer**
- Add caching service for performance
- Cache validation results
- Cache business logic calculations

## Conclusion

The new centralized architecture provides:
- **Clear separation of concerns**
- **Single source of truth for business rules**
- **Easier maintenance and testing**
- **Better code quality and consistency**
- **Foundation for future enhancements**

This architecture follows industry best practices and makes the codebase much more maintainable and scalable.
