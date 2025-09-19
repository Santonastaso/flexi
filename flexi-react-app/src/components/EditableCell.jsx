import React from 'react';
import { 
  MACHINE_STATUSES, 
  DEPARTMENT_TYPES, 
  WORK_CENTERS, 
  PRODUCT_TYPES, 
  SEAL_SIDES,
  FIELD_CONFIGS 
} from '../constants';

function EditableCell({ 
  row, 
  column, 
  table, 
  // Legacy props for backward compatibility
  value: legacyValue, 
  isEditing: legacyIsEditing, 
  onChange: legacyOnChange,
  // New props for advanced functionality
  type = 'auto',
  options = [],
  parseValue = null,
  min = null,
  max = null,
  step = null
}) {
  // Support both new and legacy API
  const isEditing = legacyIsEditing ?? table?.options?.meta?.editingRowId === row?.id;
  const initialValue = legacyValue ?? row?.original?.[column?.id];
  
  // Auto-detect type based on column ID if not specified
  const inputType = type === 'auto' ? getAutoType(column?.id) : type;
  
  // Handle input change with proper value parsing
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    let parsedValue = newValue;
    
    // Parse value if parser is provided
    if (parseValue) {
      parsedValue = parseValue(newValue);
    } else if (inputType === 'number') {
      parsedValue = parseFloat(newValue) || 0;
    } else if (inputType === 'integer') {
      parsedValue = parseInt(newValue) || 0;
    }
    
    // Use new API if available, fall back to legacy
    if (table?.options?.meta?.setEditedData) {
      table.options.meta.setEditedData(prev => ({
        ...prev,
        [column?.id]: parsedValue,
      }));
    } else if (legacyOnChange) {
      legacyOnChange(e);
    }
  };

  // Auto-detect input type based on column ID
  function getAutoType(columnId) {
    if (!columnId) return 'text';
    
    // Status fields
    if (columnId === 'status') return 'select';
    
    // Integer fields (no decimals)
    const integerFields = ['quantity', 'quantity_completed', 'numero_persone', 'bag_height', 'bag_width', 'bag_step', 'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height'];
    if (integerFields.includes(columnId)) return 'integer';

    // Decimal fields (one decimal where appropriate or two for costs)
    const oneDecimalFields = ['setup_time_standard', 'changeover_color', 'changeover_material', 't_setup_stampa', 't_setup_conf'];
    const twoDecimalFields = ['costo_h_stampa', 'costo_h_conf'];
    const plainNumberFields = ['standard_speed', 'v_stampa', 'v_conf'];
    if (oneDecimalFields.includes(columnId) || twoDecimalFields.includes(columnId) || plainNumberFields.includes(columnId)) return 'number';
    
    return 'text';
  }

  // Get select options based on column ID
  function getSelectOptions(columnId) {
    if (columnId === 'status') {
      return [
        { value: MACHINE_STATUSES.ACTIVE, label: MACHINE_STATUSES.ACTIVE },
        { value: MACHINE_STATUSES.INACTIVE, label: MACHINE_STATUSES.INACTIVE }
      ];
    }
    
    if (columnId === 'department') {
      return [
        { value: DEPARTMENT_TYPES.PRINTING, label: DEPARTMENT_TYPES.PRINTING },
        { value: DEPARTMENT_TYPES.PACKAGING, label: DEPARTMENT_TYPES.PACKAGING }
      ];
    }
    
    if (columnId === 'work_center') {
      return [
        { value: WORK_CENTERS.ZANICA, label: WORK_CENTERS.ZANICA },
        { value: WORK_CENTERS.BUSTO_GAROLFO, label: WORK_CENTERS.BUSTO_GAROLFO }
      ];
    }
    
    if (columnId === 'product_type') {
      return [
        { value: PRODUCT_TYPES.CREMA, label: 'Crema' },
        { value: PRODUCT_TYPES.LIQUIDO, label: 'Liquido' },
        { value: PRODUCT_TYPES.POLVERI, label: 'Polveri' }
      ];
    }
    
    if (columnId === 'seal_sides') {
      return [
        { value: SEAL_SIDES.THREE, label: '3 sides' },
        { value: SEAL_SIDES.FOUR, label: '4 sides' }
      ];
    }
    
    // Use custom options if provided
    return options;
  }

  if (isEditing) {
    switch (inputType) {
      case 'select': {
        const selectOptions = getSelectOptions(column?.id);
        return (
          <select
            defaultValue={initialValue}
            onChange={handleInputChange}
            style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px' }}
          >
            {selectOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }

      case 'number': {
        // Determine step for number fields: 0.1 for time-like, 0.01 for costs, default 0.1
        const decimalStep = (() => {
          if (FIELD_CONFIGS.DECIMAL_PRECISION.TWO_DECIMAL.includes(column?.id)) return FIELD_CONFIGS.FIELD_STEPS.COST;
          if (FIELD_CONFIGS.DECIMAL_PRECISION.ONE_DECIMAL.includes(column?.id)) return FIELD_CONFIGS.FIELD_STEPS.TIME;
          return FIELD_CONFIGS.FIELD_STEPS.TIME;
        })();
        return (
          <input
            type="number"
            defaultValue={initialValue}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step || decimalStep}
            style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px' }}
          />
        );
      }
        
      case 'integer':
        return (
          <input 
            type="number" 
            defaultValue={initialValue} 
            onChange={handleInputChange} 
            min={min || 0}
            max={max}
            step={1}
            style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px' }}
          />
        );
        
      default:
        return (
          <input 
            type="text" 
            defaultValue={initialValue} 
            onChange={handleInputChange} 
            style={{ width: '100%', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px' }}
          />
        );
    }
  }

  // Display value
  const displayValue = initialValue ?? '';
  
  // Format display value based on type
  if (inputType === 'number' || inputType === 'integer') {
    return <span>{displayValue}</span>;
  }
  
  return <span>{displayValue}</span>;
}

export default EditableCell;