import React, { useMemo, useState, useEffect, useRef } from 'react';

// Filter Dropdown Component
const FilterDropdown = ({ column, options, onFilterChange, isOpen, onToggle, activeFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedValues, setSelectedValues] = useState(new Set());
  const [isSelectAll, setIsSelectAll] = useState(true);
  const dropdownRef = useRef(null);
  
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const filtered = options.filter(option => 
      option && option.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  }, [options, searchTerm, column]);

  // Initialize selected values when dropdown opens
  useEffect(() => {
    if (isOpen) {
      if (activeFilter && Array.isArray(activeFilter)) {
        setSelectedValues(new Set(activeFilter));
        setIsSelectAll(activeFilter.length === options.length);
      } else if (activeFilter) {
        setSelectedValues(new Set([activeFilter]));
        setIsSelectAll(false);
      } else {
        setSelectedValues(new Set(options));
        setIsSelectAll(true);
      }
    }
  }, [isOpen, activeFilter, options]);

  const handleOptionToggle = (option) => {
    const newSelectedValues = new Set(selectedValues);
    if (newSelectedValues.has(option)) {
      newSelectedValues.delete(option);
    } else {
      newSelectedValues.add(option);
    }
    setSelectedValues(newSelectedValues);
    setIsSelectAll(newSelectedValues.size === filteredOptions.length);
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedValues(new Set());
      setIsSelectAll(false);
    } else {
      setSelectedValues(new Set(filteredOptions));
      setIsSelectAll(true);
    }
  };

  const handleClearFilter = () => {
    setSelectedValues(new Set());
    setIsSelectAll(false);
  };

  const handleApplyFilter = () => {
    const selectedArray = Array.from(selectedValues);
    onFilterChange(column, selectedArray.length === 0 ? '' : selectedArray);
    setSearchTerm('');
    onToggle();
  };

  const handleCancel = () => {
    setSearchTerm('');
    onToggle();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Reset search term when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedValues(new Set());
      setIsSelectAll(true);
    }
  }, [isOpen]);

  // Calculate position when dropdown opens
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const button = dropdownRef.current.querySelector('button');
      if (button) {
        const rect = button.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const dropdownWidth = 192; // w-48 = 12rem = 192px
        
        // Position below the button
        let leftPosition = 0; // Relative to the button
        
        // If the dropdown would go off the right edge, position it to the left of the button
        if (rect.left + dropdownWidth > viewportWidth) {
          leftPosition = -dropdownWidth + rect.width;
        }
        
        setPosition({
          top: rect.height + 5, // Position below the button with small gap
          left: leftPosition,
        });
      }
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={`inline-flex items-center justify-center w-4 h-4 transition-colors ${
          activeFilter ? 'text-blue-600 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'
        }`}
        title={activeFilter ? `Filtro attivo: ${activeFilter}` : 'Filtra'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
        </svg>
      </button>
      
      {isOpen && (
        <div 
          className="absolute bg-white border border-gray-300 rounded-md shadow-lg z-[99999] w-48" 
          style={{
            top: position.top,
            left: position.left
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Filter by values section */}
          <div className="p-2">
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={handleSelectAll}
                className="text-blue-600 text-xs font-medium hover:underline"
              >
                {isSelectAll ? 'Select all' : `Select all ${filteredOptions.length}`}
              </button>
              <button
                onClick={handleClearFilter}
                className="text-blue-600 text-xs font-medium hover:underline"
              >
                Clear
              </button>
            </div>
            
            <div className="text-xs text-gray-600 mb-1">
              Displaying {filteredOptions.length}
            </div>
            
            {/* Search input */}
            <div className="relative mb-1">
              <input
                type="text"
                placeholder="Search values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
              </div>
            </div>
            
            {/* Options list with checkboxes - Fixed height scrollable container */}
            <div className="h-16 overflow-y-auto border border-gray-200 rounded">
              {filteredOptions.map((option, index) => (
                <label
                  key={`${option}-${index}`}
                  className="flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.has(option)}
                    onChange={() => handleOptionToggle(option)}
                    className="mr-2 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-xs truncate flex-1">{option || '(Blanks)'}</span>
                </label>
              ))}
              {filteredOptions.length === 0 && searchTerm && (
                <div className="px-2 py-2 text-xs text-gray-500 text-center">
                  No results found
                </div>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="border-t border-gray-200 p-2 flex justify-end space-x-1">
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyFilter}
              className="px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;

