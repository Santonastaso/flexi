# Implementation Summary: ASD_notes and material_availability_global

## Overview
This implementation adds two new columns to the system:
1. **ASD_notes** - A text field for ASD-specific notes (similar to user_notes)
2. **material_availability_global** - A percentage field for global material availability (similar to material_availability_isp and material_availability_lotti)

## Database Changes

### 1. Supabase Migration Script
**File:** `supabase_migration_add_asd_notes_and_material_availability_global.sql`

**Changes:**
- Added `ASD_notes text null` to both `orders_master_dump` and `odp_orders` tables
- Added `material_availability_global integer null` to both tables
- Updated `sync_orders_from_master_dump()` function to include the new columns in INSERT and UPDATE operations
- Added conflict resolution for the new columns in the ON CONFLICT clause

## Frontend Changes

### 1. Constants and Validation
**Files:** 
- `src/constants.js`
- `src/utils/yupSchemas.js`

**Changes:**
- Added `ASD_NOTES: 'ASD_notes'` and `MATERIAL_AVAILABILITY_GLOBAL: 'material_availability_global'` to FORM_FIELDS
- Added validation for `ASD_notes` as nullable string
- Added validation for `material_availability_global` as nullable number (0-100)

### 2. Form Configuration
**File:** `src/components/formConfigs/backlogFormConfig.js`

**Changes:**
- Added ASD_notes field in "Dati Commerciali" section as textarea (3 rows)
- Added new "Disponibilità Materiali" section with material_availability_global field (number input, 0-100 range)

### 3. Backlog Form Component
**File:** `src/components/BacklogForm.jsx`

**Changes:**
- Added new fields to `initialData` object
- Added new fields to `cleanedData` object with proper null handling
- Both fields are properly handled in form submission

### 4. Data Tables

#### TaskPoolDataTable
**File:** `src/components/TaskPoolDataTable.jsx`

**Changes:**
- Added "Material Global (%)" column with colored circular indicators (same styling as existing material availability columns)
- Added "Note ASD" column with truncated text display and tooltip
- Updated info tooltip to include both new fields

#### BacklogListPage
**File:** `src/pages/BacklogListPage.jsx`

**Changes:**
- Added "Material Global (%)" column with colored circular indicators
- Added "Note ASD" column with truncated text display and tooltip

### 5. Gantt Chart
**File:** `src/components/GanttChart.jsx`

**Changes:**
- Updated info tooltip to include both new fields

## Styling and UI

### Material Availability Global
- Uses the same color scheme as existing material availability fields:
  - Gray (≤39%): `bg-gray-300`
  - Yellow (40-69%): `bg-yellow-400` 
  - Green (≥70%): `bg-green-400`
- Displays as circular indicators with percentage values
- Shows "N/A" when value is null or not a number

### ASD Notes
- Displays as truncated text with full content in tooltip
- Shows "N/A" when value is null or empty
- Maximum width of 200px with ellipsis for overflow

## Integration Points

### Database Sync
The new columns are fully integrated into the client dump sync process:
- New data from client dumps will populate both fields
- Updates to existing records will sync the new fields
- Conflict resolution handles updates to both fields

### Form Handling
- Both fields are optional (nullable in database)
- Proper validation ensures data integrity
- Form submission handles null values correctly
- Edit mode properly loads existing values

### Display Components
- All data tables show the new columns
- Tooltips include the new field information
- Consistent styling with existing similar fields

## Usage Instructions

### For Database Administrators
1. Run the SQL migration script on your Supabase database
2. The sync function will automatically handle the new columns

### For Users
1. **ASD Notes**: Can be added/edited in the backlog form under "Dati Commerciali" section
2. **Material Availability Global**: Can be set in the backlog form under "Disponibilità Materiali" section (0-100%)
3. Both fields are visible in all data tables and tooltips
4. Fields are optional and can be left empty

## Testing Recommendations

1. **Database**: Verify columns are created and sync function works
2. **Forms**: Test adding/editing orders with new fields
3. **Display**: Verify columns appear correctly in all tables
4. **Validation**: Test edge cases (empty values, invalid ranges)
5. **Sync**: Test client dump sync with new fields populated

## Notes
- All changes maintain backward compatibility
- Existing data will have null values for new fields
- No breaking changes to existing functionality
- Follows the same patterns as existing similar fields (user_notes, material_availability_isp/lotti)
