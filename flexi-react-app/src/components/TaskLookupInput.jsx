import React from 'react';

const TaskLookupInput = ({
  placeholder,
  value,
  onChange,
  onLookup,
  suggestions,
  field,
  fieldLabel,
  onDropdownSelect
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onLookup();
    }
  };

  const getFilteredSuggestions = () => {
    if (!value) return [];
    
    return suggestions
      .filter(order => {
        const fieldValue = order[field];
        return fieldValue && fieldValue.toLowerCase().includes(value.toLowerCase());
      })
      .sort((a, b) => {
        // Sort by exact match first, then by relevance
        const aExact = a[field] && a[field].toLowerCase() === value.toLowerCase();
        const bExact = b[field] && b[field].toLowerCase() === value.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return (a[field] || '').localeCompare(b[field] || '');
      })
      .slice(0, 5);
  };

  const filteredSuggestions = getFilteredSuggestions();

  return (
    <div className="task-lookup-item">
      <div className="task-lookup-input-container">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyPress={handleKeyPress}
          className="task-lookup-input"
        />
        {value && (
          <div className="task-lookup-dropdown">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map(order => (
                <div 
                  key={order.id} 
                  className="task-lookup-option"
                  onClick={() => onDropdownSelect(order, field, fieldLabel, order[field])}
                >
                  <span className="task-lookup-odp">{order[field]}</span>
                  <span className="task-lookup-product">{order.product_name || 'Prodotto non specificato'}</span>
                  <span className="task-lookup-workcenter">({order.work_center})</span>
                </div>
              ))
            ) : (
              <div className="task-lookup-option no-results">
                <span>Nessun risultato trovato</span>
              </div>
            )}
          </div>
        )}
      </div>
      <button onClick={onLookup} className="nav-btn today">
        Cerca {fieldLabel}
      </button>
    </div>
  );
};

export default TaskLookupInput;
