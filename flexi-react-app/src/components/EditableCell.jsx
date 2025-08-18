import React from 'react';

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
    const integerFields = ['quantity', 'quantity_completed', 'quantity_per_box', 'numero_persone', 'bag_height', 'bag_width', 'bag_step', 'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height'];
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
        { value: 'ACTIVE', label: 'ACTIVE' },
        { value: 'INACTIVE', label: 'INACTIVE' },
        { value: 'MAINTENANCE', label: 'MAINTENANCE' }
      ];
    }
    
    if (columnId === 'department') {
      return [
        { value: 'STAMPA', label: 'STAMPA' },
        { value: 'CONFEZIONAMENTO', label: 'CONFEZIONAMENTO' }
      ];
    }
    
    if (columnId === 'work_center') {
      return [
        { value: 'ZANICA', label: 'ZANICA' },
        { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
      ];
    }
    
    if (columnId === 'product_type') {
      return [
        { value: 'crema', label: 'Crema' },
        { value: 'liquido', label: 'Liquido' },
        { value: 'polveri', label: 'Polveri' }
      ];
    }
    
    if (columnId === 'seal_sides') {
      return [
        { value: '3', label: '3 sides' },
        { value: '4', label: '4 sides' }
      ];
    }
    
    // Use custom options if provided
    return options;
  }

  if (isEditing) {
    switch (inputType) {
      case 'select':
        const selectOptions = getSelectOptions(column?.id);
        return (
          <select 
            defaultValue={initialValue} 
            onChange={handleInputChange} 
            style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            {selectOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        
      case 'number':
        // Determine step for number fields: 0.1 for time-like, 0.01 for costs, default 0.1
        const decimalStep = (() => {
          if (['costo_h_stampa', 'costo_h_conf'].includes(column?.id)) return 0.01;
          if (['setup_time_standard', 'changeover_color', 'changeover_material', 't_setup_stampa', 't_setup_conf'].includes(column?.id)) return 0.1;
          return 0.1;
        })();
        return (
          <input 
            type="number" 
            defaultValue={initialValue} 
            onChange={handleInputChange} 
            min={min}
            max={max}
            step={step || decimalStep}
            style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        );
        
      case 'integer':
        return (
          <input 
            type="number" 
            defaultValue={initialValue} 
            onChange={handleInputChange} 
            min={min || 0}
            max={max}
            step={1}
            style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        );
        
      default:
        return (
          <input 
            type="text" 
            defaultValue={initialValue} 
            onChange={handleInputChange} 
            style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
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