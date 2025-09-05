import React, { useEffect, useMemo } from 'react';
import { useSchedulerStore, useUIStore } from '../store';
import { format, addDays } from 'date-fns';
import GenericForm from './GenericForm';
import { offTimeFormConfig } from './formConfigs';

function OffTimeForm({ machineId, currentDate, onSuccess }) {
  const { setMachineUnavailability } = useSchedulerStore();
  const { showAlert } = useUIStore();

  // Create initial data with dynamic date values
  const initialData = useMemo(() => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    return {
      startDate: format(today, 'yyyy-MM-dd'),
      endDate: format(tomorrow, 'yyyy-MM-dd'),
      startTime: offTimeFormConfig.sections[0].fields[1].defaultValue,
      endTime: offTimeFormConfig.sections[0].fields[3].defaultValue
    };
  }, [currentDate]);

  const handleSubmit = async (data) => {
    await setMachineUnavailability(machineId, data.startDate, data.endDate, data.startTime, data.endTime);
    showAlert('Indisponibilità macchina impostata con successo!', 'success');
    
    // Call the success callback to refresh calendar data
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <GenericForm
      config={offTimeFormConfig}
      initialData={initialData}
      onSubmit={handleSubmit}
      onSuccess={onSuccess}
      className="p-1 bg-white rounded-lg shadow-sm border"
    />
  );
}

export default OffTimeForm;
