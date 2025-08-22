import React, { useState, useEffect, useRef } from 'react';

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
    <div className="searchable-dropdown" ref={dropdownRef} style={{ width }}>
      <label htmlFor={id}>{label}:</label>
      <input 
        type="text" 
        id={id}
        value={searchValue} 
        onChange={handleSearchChange} 
        onFocus={handleInputFocus} 
        placeholder={searchPlaceholder} 
      />
      {isOpen && options.length > 0 && (
        <div className="dropdown-options">
          {/* "All" option */}
          <div 
            className={`dropdown-option ${allVisibleSelected ? 'selected' : ''}`}
            onMouseDown={handleAllOptionClick}
          >
            <span className="phase-name">All {label}s</span>
            <span className="phase-description">Show all {label.toLowerCase()}s</span>
          </div>
          
          {/* Individual options */}
          {filteredOptions.map(option => (
            <div 
              key={option} 
              className={`dropdown-option ${selectedOptions.includes(option) ? 'selected' : ''}`}
              onMouseDown={(e) => handleOptionClick(e, option)}
            >
              <span className="phase-name">{option}</span>
              <span className="phase-description">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchableDropdown;
