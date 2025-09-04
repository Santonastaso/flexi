import React from 'react';
import { Input } from './ui';

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
    <div className="task-lookup-input-container">
      <Input
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
                <span className="task-lookup-product">
                  {field === 'odp_number' && (
                    <>{order.article_code || 'Codice articolo FLEXI'}</>
                  )}
                  {field === 'article_code' && (
                    <>{order.odp_number || 'Numero ODP'}</>
                  )}
                  {field === 'nome_cliente' && (
                    <>{order.article_code || 'Codice articolo FLEXI'}</>
                  )}
                </span>
                <span className="task-lookup-workcenter">({order.work_center})</span>
              </div>
            ))
          ) : (
            <div className="task-lookup-option">
              Nessun risultato trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskLookupInput;
