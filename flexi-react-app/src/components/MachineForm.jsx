import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMachineStore, useUIStore } from '../store';
import { useProductionCalculations } from '../hooks';
import { useErrorHandler } from '../hooks';
import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  MACHINE_STATUSES,
  SHIFT_TYPES,
  DEFAULT_VALUES
} from '../constants';

// --- Reusable Helper Functions ---

// Validates that string fields are present and not just whitespace.
const validateRequiredStrings = (data, fields) => {
  const errors = [];
  fields.forEach(({ field, name }) => {
    if (!data[field]?.trim()) {
      errors.push(`${name} is required`);
    }
  });
  return errors;
};

// Validates that numeric fields are present and not negative.
const validateNumericFields = (data, fields) => {
  const errors = [];
  fields.forEach(({ field, name }) => {
    const value = data[field];
    if (value === '' || value === null || value === undefined) {
      errors.push(`${name} is required`);
    } else if (Number(value) < 0) {
      errors.push(`${name} cannot be negative`);
    }
  });
  return errors;
};

// Validates that a 'min' value is not greater than a 'max' value.
const validateMinMaxPairs = (data, pairs) => {
  const errors = [];
  pairs.forEach(({ min, max, name }) => {
    if (Number(data[min]) > Number(data[max])) {
      errors.push(`Min ${name} cannot exceed Max ${name}`);
    }
  });
  return errors;
};


// --- Constants for Validation ---
// Defined outside the component for better performance.

const REQUIRED_STRING_FIELDS = [
  { field: 'machine_name', name: 'Machine Name' },
  { field: 'machine_type', name: 'Machine Type' },
  { field: 'work_center', name: 'Work Center' },
  { field: 'department', name: 'Department' },
];

const REQUIRED_NUMERIC_FIELDS = [
  { field: 'min_web_width', name: 'Min Web Width' },
  { field: 'max_web_width', name: 'Max Web Width' },
  { field: 'min_bag_height', name: 'Min Bag Height' },
  { field: 'max_bag_height', name: 'Max Bag Height' },
  { field: 'standard_speed', name: 'Standard Speed' },
  { field: 'setup_time_standard', name: 'Setup Time' },
];

const MIN_MAX_PAIRS = [
    { min: 'min_web_width', max: 'max_web_width', name: 'Web Width' },
    { min: 'min_bag_height', max: 'max_bag_height', name: 'Bag Height' },
];

function MachineForm({ machineToEdit, onSuccess }) {
  const { selectedWorkCenter, showAlert } = useUIStore();
  const { addMachine, updateMachine } = useMachineStore();
  const { handleAsync } = useErrorHandler('MachineForm');
  
  const isEditMode = Boolean(machineToEdit);
  
  const initialFormData = useMemo(() => ({
    department: machineToEdit?.department || DEFAULT_VALUES.MACHINE.DEPARTMENT,
    machine_type: machineToEdit?.machine_type || '',
    machine_name: machineToEdit?.machine_name || '',
    work_center: machineToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? DEFAULT_VALUES.MACHINE.WORK_CENTER : selectedWorkCenter),
    min_web_width: machineToEdit?.min_web_width || DEFAULT_VALUES.MACHINE.MIN_WEB_WIDTH,
    max_web_width: machineToEdit?.max_web_width || DEFAULT_VALUES.MACHINE.MAX_WEB_WIDTH,
    min_bag_height: machineToEdit?.min_bag_height || DEFAULT_VALUES.MACHINE.MIN_BAG_HEIGHT,
    max_bag_height: machineToEdit?.max_bag_height || DEFAULT_VALUES.MACHINE.MAX_BAG_HEIGHT,
    standard_speed: machineToEdit?.standard_speed || '',
    setup_time_standard: machineToEdit?.setup_time_standard || DEFAULT_VALUES.MACHINE.SETUP_TIME_STANDARD,
    changeover_color: machineToEdit?.changeover_color || DEFAULT_VALUES.MACHINE.CHANGEOVER_COLOR,
    changeover_material: machineToEdit?.changeover_material || DEFAULT_VALUES.MACHINE.CHANGEOVER_MATERIAL,
    active_shifts: machineToEdit?.active_shifts || DEFAULT_VALUES.MACHINE.ACTIVE_SHIFTS,
    status: machineToEdit?.status || DEFAULT_VALUES.MACHINE.STATUS,
  }), [selectedWorkCenter, machineToEdit]);

  const { getValidMachineTypes } = useProductionCalculations();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    watch,
    setValue,
    getValues,
    reset
  } = useForm({
    defaultValues: initialFormData
  });

  const department = watch('department');
  const activeShifts = watch('active_shifts') || [];

  useEffect(() => {
    const types = getValidMachineTypes(department);
    if (!types.includes(getValues('machine_type'))) {
      setValue('machine_type', '');
    }
  }, [department, getValidMachineTypes, getValues, setValue]);

  const handleShiftChange = (e) => {
    const { value, checked } = e.target;
    const currentShifts = getValues('active_shifts') || [];
    
    if (checked) {
      setValue('active_shifts', [...currentShifts, value].sort());
    } else {
      setValue('active_shifts', currentShifts.filter(s => s !== value));
    }
  };

  const onSubmit = async (data) => {
    // --- Streamlined Validation Logic ---
    let validationErrors = [
      ...validateRequiredStrings(data, REQUIRED_STRING_FIELDS),
      ...validateNumericFields(data, REQUIRED_NUMERIC_FIELDS),
      ...validateMinMaxPairs(data, MIN_MAX_PAIRS),
    ];
    
    // Department-specific required fields
    if (data.department === DEPARTMENT_TYPES.PRINTING) {
      validationErrors.push(...validateNumericFields(data, [{ field: 'changeover_color', name: 'Changeover Color' }]));
    }
    if (data.department === DEPARTMENT_TYPES.PACKAGING) {
      validationErrors.push(...validateNumericFields(data, [{ field: 'changeover_material', name: 'Material Changeover' }]));
    }
    
    if (validationErrors.length > 0) {
      showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    // --- Submission Logic ---
    await handleAsync(
      async () => {
        if (isEditMode) {
          await updateMachine(machineToEdit.id, data);
        } else {
          await addMachine(data);
        }
        if (onSuccess) onSuccess();
        reset(initialFormData);
      },
      { 
        context: isEditMode ? 'Update Machine' : 'Add Machine', 
        fallbackMessage: isEditMode ? 'Aggiornamento macchina fallito' : 'Aggiunta macchina fallita'
      }
    );
  };

  return (
    <div className="content-section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">Identificazione</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group">
              <label htmlFor="department">Department *</label>
              <select id="department" {...register('department')}>
                <option value={DEPARTMENT_TYPES.PRINTING}>{DEPARTMENT_TYPES.PRINTING}</option>
                <option value={DEPARTMENT_TYPES.PACKAGING}>{DEPARTMENT_TYPES.PACKAGING}</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="machine_type">Machine Type *</label>
              <select id="machine_type" {...register('machine_type')}>
                <option value="">Seleziona tipo macchina</option>
                {getValidMachineTypes(department).map(type => 
                  <option key={type} value={type}>{type}</option>
                )}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="machine_name">Machine Name *</label>
              <input 
                type="text" 
                id="machine_name" 
                {...register('machine_name')}
                placeholder="Nome descrittivo" 
              />
            </div>
            
            <div className="form-group">
                <label htmlFor="work_center">Work Center *</label>
                {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                  <select {...register('work_center')} id="work_center">
                    <option value="">Seleziona un centro di lavoro</option>
                    <option value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</option>
                    <option value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    id="work_center"
                    value={selectedWorkCenter || 'N/A'}
                    disabled
                    className="disabled-input"
                  />
                )}
                {selectedWorkCenter !== WORK_CENTERS.BOTH && (
                    <small>Il centro di lavoro è pre-impostato.</small>
                )}
            </div>
          </div>
        </div>

        {/* CAPACITÀ TECNICHE Section */}
        <div className="form-section">
          <h3 className="section-title">Capacità Tecniche</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group">
              <label htmlFor="min_web_width">Min Web Width (mm) *</label>
              <input type="number" id="min_web_width" {...register('min_web_width')}/>
            </div>
            <div className="form-group">
              <label htmlFor="max_web_width">Max Web Width (mm) *</label>
              <input type="number" id="max_web_width" {...register('max_web_width')}/>
            </div>
            <div className="form-group">
              <label htmlFor="min_bag_height">Min Bag Height (mm) *</label>
              <input type="number" id="min_bag_height" {...register('min_bag_height')}/>
            </div>
            <div className="form-group">
              <label htmlFor="max_bag_height">Max Bag Height (mm) *</label>
              <input type="number" id="max_bag_height" {...register('max_bag_height')}/>
            </div>
          </div>
        </div>

        {/* PERFORMANCE Section */}
        <div className="form-section">
          <h3 className="section-title">Performance</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="standard_speed">Standard Speed *</label>
              <input 
                type="number" 
                id="standard_speed" 
                {...register('standard_speed')}
                placeholder="pz/h o mt/h" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="setup_time_standard">Setup Time Standard (h) *</label>
              <input type="number" id="setup_time_standard" {...register('setup_time_standard')}/>
            </div>
            {department === DEPARTMENT_TYPES.PRINTING && (
              <div className="form-group">
                <label htmlFor="changeover_color">Changeover Color (h) *</label>
                <input type="number" id="changeover_color" {...register('changeover_color')}/>
              </div>
            )}
            {department === DEPARTMENT_TYPES.PACKAGING && (
              <div className="form-group">
                <label htmlFor="changeover_material">Material Changeover (h) *</label>
                <input type="number" id="changeover_material" {...register('changeover_material')}/>
              </div>
            )}
          </div>
        </div>
        
        {/* DISPONIBILITÀ Section */}
        <div className="form-section">
          <h3 className="section-title">Disponibilità</h3>
          <div className="form-group">
            <label>Active Shifts</label>
            <div className="checkbox-group">
              {[SHIFT_TYPES.T1, SHIFT_TYPES.T2, SHIFT_TYPES.T3].map(shift => (
                <label key={shift}>
                  <input 
                    type="checkbox" 
                    value={shift} 
                    checked={activeShifts.includes(shift)} 
                    onChange={handleShiftChange} 
                  /> {shift}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button type="submit" className="nav-btn today" disabled={isSubmitting}>
            {isSubmitting 
              ? (isEditMode ? 'Aggiornamento...' : 'Aggiunta...') 
              : (isEditMode ? 'Aggiorna Macchina' : 'Aggiungi Macchina')
            }
          </button>
        </div>
      </form>
    </div>
  );
}

export default MachineForm;