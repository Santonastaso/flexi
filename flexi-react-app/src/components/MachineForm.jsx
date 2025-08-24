import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMachineStore, useUIStore } from '../store';
import { useProductionCalculations } from '../hooks';
import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  MACHINE_STATUSES,
  SHIFT_TYPES,
  DEFAULT_VALUES
} from '../constants';

function MachineForm({ machineToEdit }) {
  const { selectedWorkCenter } = useUIStore();
  const { addMachine, updateMachine } = useMachineStore();
  
  const isEditMode = Boolean(machineToEdit);
  
  const initialFormData = {
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
  };

  const { getValidMachineTypes } = useProductionCalculations();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    getValues
  } = useForm({
    defaultValues: initialFormData
  });

  const department = watch('department');

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
      setValue('active_shifts', [...currentShifts, value]);
    } else {
      setValue('active_shifts', currentShifts.filter(s => s !== value));
    }
  };

  const onSubmit = async (data) => {
    if (isEditMode) {
      await updateMachine(machineToEdit.id, data);
    } else {
      await addMachine(data);
    }
  };

  return (
    <div className="content-section">
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">Identificazione</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group">
              <label htmlFor="department">Department *</label>
              <select 
                id="department" 
                {...register('department')}
                className={errors.department ? 'error' : ''}
              >
                <option value={DEPARTMENT_TYPES.PRINTING}>{DEPARTMENT_TYPES.PRINTING}</option>
                <option value={DEPARTMENT_TYPES.PACKAGING}>{DEPARTMENT_TYPES.PACKAGING}</option>
              </select>
              {errors.department && <span className="error-message">{errors.department.message}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="machine_type">Machine Type *</label>
              <select 
                id="machine_type" 
                {...register('machine_type')}
                className={errors.machine_type ? 'error' : ''}
              >
                <option value="">Select machine type</option>
                {getValidMachineTypes(department).map(type => 
                  <option key={type} value={type}>{type}</option>
                )}
              </select>
              {errors.machine_type && <span className="error-message">{errors.machine_type.message}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="machine_name">Machine Name *</label>
              <input 
                type="text" 
                id="machine_name" 
                {...register('machine_name')}
                placeholder="Descriptive name" 
                className={errors.machine_name ? 'error' : ''}
              />
              {errors.machine_name && <span className="error-message">{errors.machine_name.message}</span>}
            </div>
            
                              <div className="form-group">
                    <label htmlFor="work_center">Work Center *</label>
                    {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                      <select
                        {...register('work_center', { required: 'Work center is required' })}
                        id="work_center"
                        className={errors.work_center ? 'error' : ''}
                      >
                        <option value="">Select a work center</option>
                        <option value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</option>
                        <option value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        id="work_center"
                        value={selectedWorkCenter || 'No work center selected'}
                        disabled
                        className="disabled-input"
                        style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                      />
                    )}
                    {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                      errors.work_center && <span className="error-message">{errors.work_center.message}</span>
                    ) : (
                      <small style={{ color: '#666', fontSize: '12px' }}>
                        Work center is set based on your login selection
                      </small>
                    )}
                  </div>
          </div>
        </div>

        {/* CAPACITÀ TECNICHE Section */}
        <div className="form-section">
          <h3 className="section-title">Capacità Tecniche</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="min_web_width">Min Web Width (mm)</label>
              <input 
                type="number" 
                id="min_web_width" 
                {...register('min_web_width')}
                min="0" 
                step="1" 
                className={errors.min_web_width ? 'error' : ''}
              />
              {errors.min_web_width && <span className="error-message">{errors.min_web_width.message}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="max_web_width">Max Web Width (mm) *</label>
              <input 
                type="number" 
                id="max_web_width" 
                {...register('max_web_width')}
                min="0" 
                step="1" 
                className={errors.max_web_width ? 'error' : ''}
              />
              {errors.max_web_width && <span className="error-message">{errors.max_web_width.message}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="min_bag_height">Min Bag Height (mm)</label>
              <input 
                type="number" 
                id="min_bag_height" 
                {...register('min_bag_height')}
                min="0" 
                step="1" 
                className={errors.min_bag_height ? 'error' : ''}
              />
              {errors.min_bag_height && <span className="error-message">{errors.min_bag_height.message}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="max_bag_height">Max Bag Height (mm) *</label>
              <input 
                type="number" 
                id="max_bag_height" 
                {...register('max_bag_height')}
                min="0" 
                step="1" 
                className={errors.max_bag_height ? 'error' : ''}
              />
              {errors.max_bag_height && <span className="error-message">{errors.max_bag_height.message}</span>}
            </div>
          </div>
        </div>

        {/* PERFORMANCE Section */}
        <div className="form-section">
          <h3 className="section-title">Performance</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="standard_speed">Standard Speed</label>
              <input 
                type="number" 
                id="standard_speed" 
                {...register('standard_speed')}
                placeholder="pz/h or mt/h" 
                min="0" 
                step="1" 
                className={errors.standard_speed ? 'error' : ''}
              />
              {errors.standard_speed && <span className="error-message">{errors.standard_speed.message}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="setup_time_standard">Setup Time Standard (h)</label>
              <input 
                type="number" 
                id="setup_time_standard" 
                {...register('setup_time_standard')}
                min="0" 
                step="0.1" 
                className={errors.setup_time_standard ? 'error' : ''}
              />
              {errors.setup_time_standard && <span className="error-message">{errors.setup_time_standard.message}</span>}
            </div>
            
            {department === DEPARTMENT_TYPES.PRINTING && (
              <div className="form-group">
                <label htmlFor="changeover_color">Changeover Color (h)</label>
                <input 
                  type="number" 
                  id="changeover_color" 
                  {...register('changeover_color')}
                  min="0" 
                  step="0.1" 
                  className={errors.changeover_color ? 'error' : ''}
                />
                {errors.changeover_color && <span className="error-message">{errors.changeover_color.message}</span>}
              </div>
            )}
            
            {department === DEPARTMENT_TYPES.PACKAGING && (
              <div className="form-group">
                <label htmlFor="changeover_material">Material Changeover (h)</label>
                <input 
                  type="number" 
                  id="changeover_material" 
                  {...register('changeover_material')}
                  min="0" 
                  step="0.1" 
                  className={errors.changeover_material ? 'error' : ''}
                />
                {errors.changeover_material && <span className="error-message">{errors.changeover_material.message}</span>}
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
              <label>
                <input 
                  type="checkbox" 
                  value={SHIFT_TYPES.T1} 
                  checked={getValues('active_shifts')?.includes(SHIFT_TYPES.T1)} 
                  onChange={handleShiftChange} 
                /> {SHIFT_TYPES.T1}
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value={SHIFT_TYPES.T2} 
                  checked={getValues('active_shifts')?.includes(SHIFT_TYPES.T2)} 
                  onChange={handleShiftChange} 
                /> {SHIFT_TYPES.T2}
              </label>
              <label>
                <input 
                  type="checkbox" 
                  value={SHIFT_TYPES.T3} 
                  checked={getValues('active_shifts')?.includes(SHIFT_TYPES.T3)} 
                  onChange={handleShiftChange} 
                /> {SHIFT_TYPES.T3}
              </label>
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button 
            type="submit" 
            className="nav-btn today"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isEditMode ? 'Updating Machine...' : 'Adding Machine...') 
              : (isEditMode ? 'Update Machine' : 'Add Machine')
            }
          </button>
        </div>
      </form>
    </div>
  );
}

export default MachineForm;
