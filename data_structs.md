# Data Structures Documentation
*Last Updated: Current Implementation*

This document describes the exact data structures used in the Flexi Production Suite application. All structures are based on the current implementation in the codebase.

## Table of Contents
1. [Machinery (Machines)](#machinery-machines)
2. [Phases (Production Phases)](#phases-production-phases)
3. [ODP (Production Orders)](#odp-production-orders)
4. [Scheduled Events (Gantt Chart)](#scheduled-events-gantt-chart)
5. [Machine Availability](#machine-availability)
6. [Data Normalization](#data-normalization)
7. [Storage Keys](#storage-keys)

---

## Machinery (Machines)

**Storage Key:** `schedulerMachines`

### Core Structure
```javascript
{
    // IDENTIFICAZIONE (Identification)
    id: string,                    // Unique identifier (auto-generated)
    machine_id: string,            // Human-readable ID (TYPE_WORKCENTER_NN format)
    machine_name: string,          // Machine name (required)
    machine_type: string,          // Machine type (required)
    work_center: string,           // Work center (required)
    department: string,            // Department (required)
    status: string,                // Status: 'ACTIVE', 'INACTIVE', 'MAINTENANCE'
    
    // CAPACITÀ TECNICHE (Technical Capacity)
    min_web_width: number|null,    // Minimum web width in mm
    max_web_width: number,         // Maximum web width in mm (required)
    min_bag_height: number|null,   // Minimum bag height in mm
    max_bag_height: number,        // Maximum bag height in mm (required)
    
    // PERFORMANCE
    standard_speed: number|null,   // Standard production speed
    setup_time_standard: number|null, // Standard setup time in hours
    changeover_color: number|null, // Color changeover time (STAMPA only)
    changeover_material: number|null, // Material changeover time (CONFEZIONAMENTO only)
    
    // DISPONIBILITÀ (Availability)
    active_shifts: string[],       // Array of active shift codes (T1, T2, T3)
    
    // METADATA
    created_at: string,            // ISO timestamp
    updated_at: string             // ISO timestamp
}
```

### Machine Types by Department
- **STAMPA (Printing):**
  - `DIGITAL_PRINT` → `DIGI_WORKCENTER_NN`
  - `FLEXO_PRINT` → `FLEX_WORKCENTER_NN`
  - `ROTOGRAVURE` → `ROTO_WORKCENTER_NN`

- **CONFEZIONAMENTO (Packaging):**
  - `DOYPACK` → `DOYP_WORKCENTER_NN`
  - `PLURI_PIU` → `MACH_WORKCENTER_NN`
  - `MONO_PIU` → `MACH_WORKCENTER_NN`

### Work Centers
- `ZANICA` → `ZAN` prefix in machine_id
- `BUSTO_GAROLFO` → `BGF` prefix in machine_id

### Conditional Fields
- **`changeover_color`**: Only visible/used when `department === 'STAMPA'`
- **`changeover_material`**: Only visible/used when `department === 'CONFEZIONAMENTO'`

---

## Phases (Production Phases)

**Storage Key:** `productionPhases`

### Core Structure
```javascript
{
    // IDENTIFICAZIONE (Identification)
    id: string,                    // Unique identifier (auto-generated)
    name: string,                  // Phase name (required)
    department: string,            // Department: 'STAMPA' or 'CONFEZIONAMENTO' (required)
    numero_persone: number,        // Number of people required (required, min: 1)
    
    // PRINTING PARAMETERS (STAMPA only)
    V_STAMPA: number,             // Printing speed in mt/h
    T_SETUP_STAMPA: number,       // Printing setup time in hours
    COSTO_H_STAMPA: number,       // Printing hourly cost in €/h
    
    // PACKAGING PARAMETERS (CONFEZIONAMENTO only)
    V_CONF: number,               // Packaging speed in pz/h
    T_SETUP_CONF: number,         // Packaging setup time in hours
    COSTO_H_CONF: number,         // Packaging hourly cost in €/h
    
    // PHASE CONTENT (CONFEZIONAMENTO only)
    contenuto_fase: string|null,  // Phase content description
    
    // METADATA
    created_at: string,            // ISO timestamp
    updated_at: string             // ISO timestamp
}
```

### Department-Specific Behavior
- **STAMPA**: Shows printing parameters, hides packaging parameters and phase content
- **CONFEZIONAMENTO**: Shows packaging parameters and phase content, hides printing parameters

### Default Values
- `numero_persone`: 1
- `V_STAMPA`: 6000 mt/h
- `T_SETUP_STAMPA`: 0.5 h
- `COSTO_H_STAMPA`: 50 €/h
- `V_CONF`: 1000 pz/h
- `T_SETUP_CONF`: 0.25 h
- `COSTO_H_CONF`: 40 €/h

---

## ODP (Production Orders)

**Storage Key:** `odpOrders`

### Core Structure
```javascript
{
    // IDENTIFICAZIONE (Identification)
    id: string,                    // Unique identifier (auto-generated)
    odp_number: string,            // ODP number (required, unique, format: OP000001)
    article_code: string,          // Article code (required, format: P0XXXX, ISP0XXXX)
    production_lot: string,        // Production lot (required, format: AAPU001)
    work_center: string,           // Work center (auto-determined, not user input)
    nome_cliente: string,          // Client name (user input)
    description: string,           // Order description (user input)
    
    // SPECIFICHE TECNICHE (Technical Specifications)
    bag_height: number,            // Bag height in mm (required)
    bag_width: number,             // Bag width in mm (required)
    bag_step: number,              // Bag step in mm (required)
    seal_sides: number,            // Seal sides: 3 or 4 (default: 3)
    product_type: string,          // Product type: 'crema', 'liquido', 'polveri'
    quantity: number,              // Quantity in units (required)
    
    // PIANIFICAZIONE (Planning)
    production_start: string|null, // ISO timestamp (auto-determined from Gantt)
    delivery_date: string,         // ISO timestamp (user input, required)
    
    // DATI COMMERCIALI (Commercial Data)
    internal_customer_code: string, // Auto-copied from article_code
    external_customer_code: string, // External customer code (user input)
    customer_order_ref: string,    // Customer order reference (user input)
    
    // DATI LAVORAZIONE (Processing Data)
    department: string,            // Department: 'STAMPA' or 'CONFEZIONAMENTO' (auto-determined)
    fase: string,                  // Phase ID (user selection, filtered by department)
    
    // COLONNE DA CALCOLARE (Calculated Columns)
    duration: number,              // Calculated duration in hours
    cost: number,                  // Calculated cost in €
    
    // STATUS & METADATA
    status: string,                // 'Scheduled' or 'Not Scheduled' (auto-determined)
    priority: string,              // Priority: 'low', 'medium', 'high'
    created_at: string,            // ISO timestamp
    updated_at: string             // ISO timestamp
}
```

### Auto-Determination Rules

#### Work Center
- **Article code starts with `P05` or `ISP05`** → `BUSTO_GAROLFO`
- **All other article codes** → `ZANICA`

#### Department
- **Article code starts with `P0`** → `CONFEZIONAMENTO`
- **All other article codes** → `STAMPA`

#### Status
- **Task scheduled in Gantt** → `'Scheduled'`
- **Task not scheduled** → `'Not Scheduled'`

#### Production Start
- **Task scheduled in Gantt** → ISO timestamp from Gantt start
- **Task not scheduled** → `null`

### Validation Rules
- **ODP Number**: Must be unique, format `OP000001`
- **Article Code**: Must start with `P0` or `ISP0`
- **Production Lot**: Format `AAPU001`
- **Bag Width**: Must be ≥ Bag Step
- **Delivery Date**: Must be in the future
- **Quantity**: Must be > 0

---

## Scheduled Events (Gantt Chart)

**Storage Key:** `scheduledEvents`

### Core Structure
```javascript
{
    id: string,                    // Unique event identifier
    taskId: string,                // ODP number (primary field for matching)
    taskTitle: string,             // Task title (may contain ODP number)
    odp_number: string,            // ODP number (alternative field for matching)
    machine: string,               // Machine name
    date: string,                  // Date string (YYYY-MM-DD)
    startHour: number,             // Start hour (0-23)
    endHour: number,               // End hour (0-23)
    duration: number,              // Duration in hours
    type: string,                  // Event type: 'machine', 'task'
    color: string,                 // CSS color or gradient
    created_at: string             // ISO timestamp
}
```

### Event Matching Logic
Events are matched to ODP orders using multiple fields:
1. **Primary**: `event.taskId === odp.odp_number`
2. **Secondary**: `event.taskTitle.includes(odp.odp_number)`
3. **Tertiary**: `event.odp_number === odp.odp_number`

---

## Machine Availability

**Storage Key:** `machineAvailability`

### Core Structure
```javascript
{
    machine_name: string,          // Machine name
    date: string,                  // Date string (YYYY-MM-DD)
    shifts: {                      // Shift availability
        T1: boolean,               // Shift 1 (6:00-14:00)
        T2: boolean,               // Shift 2 (14:00-22:00)
        T3: boolean                // Shift 3 (22:00-6:00)
    }
}
```

---

## Data Normalization

### Utility Functions
All data is normalized using `Utils.normalize*` functions:

- **`normalizeId(id)`**: Ensures unique ID format
- **`normalizeCode(code)`**: Trims, uppercases, replaces spaces with underscores
- **`normalizeStatus(status)`**: Standardizes status values
- **`normalizeEnumLower(value)`**: Converts to lowercase enum
- **`normalizeName(name)`**: Trims, uppercases, replaces spaces with underscores

### Field Formatting
- **Names**: Uppercase, underscores instead of spaces
- **Codes**: Uppercase, underscores instead of spaces
- **Status**: Uppercase
- **Enums**: Lowercase
- **IDs**: Unique string identifiers

---

## Storage Keys

### Primary Keys
```javascript
STORAGE_KEYS = {
    MACHINES: 'schedulerMachines',
    SCHEDULED_EVENTS: 'scheduledEvents',
    MACHINE_AVAILABILITY: 'machineAvailability',
    ODP_ORDERS: 'odpOrders',
    PHASES: 'productionPhases'
}
```

### Data Persistence
- All data is stored in `localStorage`
- Data is automatically validated and normalized on write
- No automatic data deletion (only reporting of issues)
- Periodic integrity checks every 5 minutes

---

## Important Notes

### Deprecated Fields (No Longer Used)
- ❌ `name`, `nominazione` → Use `machine_name`
- ❌ `site` → Use `work_center`
- ❌ `type` → Use `department` or `machine_type`
- ❌ `assigned_phase` → Use `fase`
- ❌ `title` → Removed entirely
- ❌ `tipo_lavorazione` → Use `department`

### Data Integrity
- **No Auto-Cleanup**: System only reports issues, never deletes data automatically
- **Orphan Detection**: Identifies scheduled events without corresponding ODP orders or machines
- **Validation**: All input data is validated and normalized before storage
- **Backward Compatibility**: Legacy data is handled gracefully with fallbacks

### UI Behavior
- **Conditional Fields**: Some fields are only visible based on department selection
- **Auto-Population**: Work center, department, and status are automatically determined
- **Real-time Updates**: Status and production start update automatically with Gantt changes
- **Form Validation**: Comprehensive validation with real-time feedback

### Performance
- **Lazy Loading**: Data is loaded only when needed
- **Efficient Queries**: Optimized data retrieval methods
- **Event-Driven Updates**: UI updates triggered by data changes
- **Debug Mode**: Extensive logging when `window.DEBUG = true`
