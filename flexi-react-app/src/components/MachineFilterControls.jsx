import React from 'react';
import SearchableDropdown from './SearchableDropdown';

const MACHINE_FILTERS = [
  {
    name: 'workCenter',
    label: 'Centro di Lavoro',
    optionKey: 'workCenters',
    searchPlaceholder: 'Cerca Centri di Lavoro',
    id: 'work_center_filter'
  },
  {
    name: 'department',
    label: 'Reparto',
    optionKey: 'departments',
    searchPlaceholder: 'Cerca Reparti',
    id: 'department_filter'
  },
  {
    name: 'machineType',
    label: 'Tipo Macchina',
    optionKey: 'machineTypes',
    searchPlaceholder: 'Cerca Tipi di Macchina',
    id: 'machine_type_filter'
  },
  {
    name: 'machineName',
    label: 'Nome Macchina',
    optionKey: 'machineNames',
    searchPlaceholder: 'Cerca Nomi Macchine',
    id: 'machine_name_filter'
  }
];

function MachineFilterControls({ machineData, filters, onFilterChange }) {
  return MACHINE_FILTERS.map(filter => (
    <SearchableDropdown
      key={filter.name}
      label={filter.label}
      options={machineData[filter.optionKey]}
      selectedOptions={filters[filter.name]}
      onSelectionChange={(value) => onFilterChange(filter.name, value)}
      searchPlaceholder={filter.searchPlaceholder}
      id={filter.id}
      width="150px"
    />
  ));
}

export default MachineFilterControls;
