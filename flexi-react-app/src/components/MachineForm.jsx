import React, { useEffect, useMemo } from 'react';
import { useUIStore } from '../store';
import { useProductionCalculations, useAddMachine, useUpdateMachine } from '../hooks';
import { WORK_CENTERS } from '../constants';
import GenericForm from './GenericForm';
import { machineFormConfig } from './formConfigs';

function MachineForm({ machineToEdit, onSuccess }) {
  const { selectedWorkCenter } = useUIStore();
  const { getValidMachineTypes } = useProductionCalculations();
  
  // React Query mutations
  const addMachineMutation = useAddMachine();
  const updateMachineMutation = useUpdateMachine();
  
  const isEditMode = Boolean(machineToEdit);
  
  // Create dynamic config with machine types based on department
  const dynamicConfig = useMemo(() => {
    const config = { ...machineFormConfig };
    
    // Update machine type options dynamically
    config.sections[0].fields[1].options = [
      ...getValidMachineTypes('STAMPA').map(type => ({ value: type, label: type })),
      ...getValidMachineTypes('CONFEZIONAMENTO').map(type => ({ value: type, label: type }))
    ];
    config.sections[0].fields[1].placeholder = 'Seleziona tipo macchina';
    
    // Update work center field based on selected work center
    if (selectedWorkCenter !== WORK_CENTERS.BOTH) {
      config.sections[0].fields[3].disabled = true;
      config.sections[0].fields[3].defaultValue = selectedWorkCenter;
      config.sections[0].fields[3].helpText = 'Il centro di lavoro è pre-impostato.';
    }
    
    return config;
  }, [getValidMachineTypes, selectedWorkCenter]);

  const initialData = useMemo(() => ({
    department: machineToEdit?.department || machineFormConfig.sections[0].fields[0].defaultValue,
    machine_type: machineToEdit?.machine_type || '',
    machine_name: machineToEdit?.machine_name || '',
    work_center: machineToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? machineFormConfig.sections[0].fields[3].defaultValue : selectedWorkCenter),
    min_web_width: machineToEdit?.min_web_width || machineFormConfig.sections[1].fields[0].defaultValue,
    max_web_width: machineToEdit?.max_web_width || machineFormConfig.sections[1].fields[1].defaultValue,
    min_bag_height: machineToEdit?.min_bag_height || machineFormConfig.sections[1].fields[2].defaultValue,
    max_bag_height: machineToEdit?.max_bag_height || machineFormConfig.sections[1].fields[3].defaultValue,
    standard_speed: machineToEdit?.standard_speed || '',
    setup_time_standard: machineToEdit?.setup_time_standard || machineFormConfig.sections[2].fields[1].defaultValue,
    changeover_color: machineToEdit?.changeover_color || machineFormConfig.sections[2].fields[2].defaultValue,
    changeover_material: machineToEdit?.changeover_material || machineFormConfig.sections[2].fields[3].defaultValue,
    active_shifts: machineToEdit?.active_shifts || machineFormConfig.sections[3].fields[0].defaultValue,
    status: machineToEdit?.status || machineFormConfig.sections[3].fields[1].defaultValue,
  }), [selectedWorkCenter, machineToEdit]);

  const handleSubmit = async (data) => {
    if (isEditMode) {
      await updateMachineMutation.mutateAsync({ id: machineToEdit.id, updates: data });
    } else {
      await addMachineMutation.mutateAsync(data);
    }
    if (onSuccess) onSuccess();
  };

  // Use mutation loading state
  const isLoading = addMachineMutation.isPending || updateMachineMutation.isPending;

  return (
    <GenericForm
      config={dynamicConfig}
      initialData={initialData}
      onSubmit={handleSubmit}
      onSuccess={onSuccess}
      isEditMode={isEditMode}
      isLoading={isLoading}
    />
  );
}

export default MachineForm;