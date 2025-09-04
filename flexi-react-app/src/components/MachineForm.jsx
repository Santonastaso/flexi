import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useUIStore } from '../store';
import { useProductionCalculations, useValidation, useAddMachine, useUpdateMachine } from '../hooks';
import { useErrorHandler } from '../hooks';
import { showValidationError } from '../utils';
import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  MACHINE_STATUSES,
  SHIFT_TYPES,
  DEFAULT_VALUES
} from '../constants';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Label,
} from './ui';


function MachineForm({ machineToEdit, onSuccess }) {
  const { selectedWorkCenter } = useUIStore();
  const { handleAsync } = useErrorHandler('MachineForm');
  const { validateMachine } = useValidation();
  
  // React Query mutations
  const addMachineMutation = useAddMachine();
  const updateMachineMutation = useUpdateMachine();
  
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

  const form = useForm({
    defaultValues: initialFormData
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
    watch,
    setValue,
    getValues,
    reset
  } = form;

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
    // --- Validation Logic ---
    const validation = validateMachine(data);
    
    if (!validation.isValid) {
      showValidationError(Object.values(validation.errors));
      return;
    }
    
    // --- Submission Logic ---
    await handleAsync(
      async () => {
        if (isEditMode) {
          await updateMachineMutation.mutateAsync({ id: machineToEdit.id, updates: data });
        } else {
          await addMachineMutation.mutateAsync(data);
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

  // Use mutation loading state
  const isLoading = addMachineMutation.isPending || updateMachineMutation.isPending;

  return (
    <div className="p-2 bg-white rounded-lg shadow-sm border">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
          {/* IDENTIFICAZIONE Section */}
          <div className="space-y-3">
                           <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Identificazione</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select onValueChange={(value) => setValue('department', value)} defaultValue={getValues('department')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEPARTMENT_TYPES.PRINTING}>{DEPARTMENT_TYPES.PRINTING}</SelectItem>
                    <SelectItem value={DEPARTMENT_TYPES.PACKAGING}>{DEPARTMENT_TYPES.PACKAGING}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="machine_type">Machine Type *</Label>
                <Select onValueChange={(value) => setValue('machine_type', value)} defaultValue={getValues('machine_type')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo macchina" />
                  </SelectTrigger>
                  <SelectContent>
                    {getValidMachineTypes(department).map(type => 
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="machine_name">Machine Name *</Label>
                <Input 
                  placeholder="Nome descrittivo" 
                  {...register('machine_name')}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="work_center">Work Center *</Label>
                {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                  <Select onValueChange={(value) => setValue('work_center', value)} defaultValue={getValues('work_center')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un centro di lavoro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</SelectItem>
                      <SelectItem value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={selectedWorkCenter || 'N/A'}
                    disabled
                    className="bg-gray-50"
                  />
                )}
                {selectedWorkCenter !== WORK_CENTERS.BOTH && (
                  <p className="text-xs text-gray-500">Il centro di lavoro è pre-impostato.</p>
                )}
              </div>
            </div>
          </div>

          {/* CAPACITÀ TECNICHE Section */}
          <div className="space-y-3">
                           <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Capacità Tecniche</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="min_web_width">Min Web Width (mm) *</Label>
                <Input type="number" {...register('min_web_width')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_web_width">Max Web Width (mm) *</Label>
                <Input type="number" {...register('max_web_width')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_bag_height">Min Bag Height (mm) *</Label>
                <Input type="number" {...register('min_bag_height')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_bag_height">Max Bag Height (mm) *</Label>
                <Input type="number" {...register('max_bag_height')} />
              </div>
            </div>
          </div>

          {/* PERFORMANCE Section */}
          <div className="space-y-3">
                           <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="standard_speed">Standard Speed *</Label>
                <Input 
                  type="number" 
                  placeholder="pz/h o mt/h" 
                  {...register('standard_speed')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup_time_standard">Setup Time Standard (h) *</Label>
                <Input type="number" {...register('setup_time_standard')} />
              </div>
              {department === DEPARTMENT_TYPES.PRINTING && (
                <div className="space-y-2">
                  <Label htmlFor="changeover_color">Changeover Color (h) *</Label>
                  <Input type="number" {...register('changeover_color')} />
                </div>
              )}
              {department === DEPARTMENT_TYPES.PACKAGING && (
                <div className="space-y-2">
                  <Label htmlFor="changeover_material">Material Changeover (h) *</Label>
                  <Input type="number" {...register('changeover_material')} />
                </div>
              )}
            </div>
          </div>
        
          {/* DISPONIBILITÀ Section */}
          <div className="space-y-3">
                           <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Disponibilità</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Active Shifts</Label>
                <div className="flex flex-wrap gap-3">
                  {[SHIFT_TYPES.T1, SHIFT_TYPES.T2, SHIFT_TYPES.T3].map(shift => (
                    <div key={shift} className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id={shift}
                        value={shift} 
                        checked={activeShifts.includes(shift)} 
                        onChange={handleShiftChange}
                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <Label htmlFor={shift} className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {shift}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

                         <div className="flex justify-end pt-4">
                 <Button type="submit" size="sm" disabled={isLoading}>
                   {isLoading
                     ? (isEditMode ? 'Aggiornamento...' : 'Aggiunta...')
                     : (isEditMode ? 'Aggiorna Macchina' : 'Aggiungi Macchina')
                   }
                 </Button>
               </div>
        </form>
    </div>
  );
}

export default MachineForm;