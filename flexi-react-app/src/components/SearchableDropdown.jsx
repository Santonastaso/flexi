import React, { useState, useEffect, useRef } from 'react';
import { Input, Label } from './ui';

/**
 * Reusable SearchableDropdown component for filtering options
 * @param {Object} props - Component props
 * @param {string} props.label - Label for the dropdown
 * @param {Array} props.options - Array of available options
 * @param {Array} props.selectedOptions - Array of currently selected options
 * @param {Function} props.onSelectionChange - Callback when selection changes
 * @param {string} props.searchPlaceholder - Placeholder text for search input
 * @param {string} props.id - Unique identifier for the dropdown
 * @param {string} props.width - CSS width value (default: '200px')
 */
function SearchableDropdown({ 
  label, 
  options, 
  selectedOptions, 
  onSelectionChange, 
  searchPlaceholder, 
  id,
  width = '200px' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search value
  const filteredOptions = options.filter(option => 
    option.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Check if all visible options are selected
  const allVisibleSelected = filteredOptions.length > 0 && 
    filteredOptions.every(option => selectedOptions.includes(option));

  // Handle "All" option selection
  const handleAllOptionClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (allVisibleSelected) {
      // Remove all visible options
      const newSelection = selectedOptions.filter(option => !filteredOptions.includes(option));
      onSelectionChange(newSelection);
    } else {
      // Add all visible options
      const newSelection = [...new Set([...selectedOptions, ...filteredOptions])];
      onSelectionChange(newSelection);
    }
  };

  // Handle individual option selection
  const handleOptionClick = (e, option) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedOptions.includes(option)) {
      // Remove option
      const newSelection = selectedOptions.filter(selected => selected !== option);
      onSelectionChange(newSelection);
    } else {
      // Add option
      const newSelection = [...selectedOptions.filter(selected => selected !== ''), option];
      onSelectionChange(newSelection);
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ width }}>
      <div className="space-y-2">
        <Label htmlFor={id}>{label}:</Label>
        <Input 
          type="text" 
          id={id}
          value={searchValue} 
          onChange={handleSearchChange} 
          onFocus={handleInputFocus} 
          placeholder={searchPlaceholder} 
        />
      </div>
      {isOpen && options.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
          {/* "All" option */}
          <div 
                            className={`px-3 py-1 hover:bg-gray-100 cursor-pointer border-b border-gray-100 ${allVisibleSelected ? 'bg-navy-50 text-navy-800' : ''}`}
            onMouseDown={handleAllOptionClick}
          >
            <div className="text-xs font-bold">Tutti</div>
          </div>
          
          {/* Individual options */}
          {filteredOptions.map(option => (
            <div 
              key={option} 
              className={`px-3 py-1 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${selectedOptions.includes(option) ? 'bg-navy-50 text-navy-800' : ''}`}
              onMouseDown={(e) => handleOptionClick(e, option)}
            >
              <div className="text-xs font-normal">{option}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchableDropdown;
