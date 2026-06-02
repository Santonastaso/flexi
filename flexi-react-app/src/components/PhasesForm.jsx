import React, { useMemo } from 'react';
import { useUIStore } from '../store';
import { useAddPhase, useUpdatePhase } from '../hooks';
import { cloneFormConfig, showSuccess, valueOrDefault } from '../utils';
import { WORK_CENTERS } from '../constants';
import GenericForm from './GenericForm';
import { phaseFormConfig } from './formConfigs';

function PhasesForm({ phaseToEdit, onSuccess }) {
  const { selectedWorkCenter } = useUIStore();
  
  // React Query mutations
  const addPhaseMutation = useAddPhase();
  const updatePhaseMutation = useUpdatePhase();
  
  const isEditMode = Boolean(phaseToEdit);
  
  // Create dynamic config based on selected work center
  const dynamicConfig = useMemo(() => {
    const config = cloneFormConfig(phaseFormConfig);
    
    // Update work center field based on selected work center
    if (selectedWorkCenter !== WORK_CENTERS.BOTH) {
      config.sections[0].fields[3].disabled = true;
      config.sections[0].fields[3].defaultValue = selectedWorkCenter;
      config.sections[0].fields[3].helpText = 'Il centro di lavoro è impostato in base alla tua selezione di accesso';
    }
    
    return config;
  }, [selectedWorkCenter]);

  const initialData = useMemo(() => ({
    name: valueOrDefault(phaseToEdit?.name, ''),
    department: valueOrDefault(phaseToEdit?.department, phaseFormConfig.sections[0].fields[1].defaultValue),
    numero_persone: valueOrDefault(phaseToEdit?.numero_persone, phaseFormConfig.sections[0].fields[2].defaultValue),
    work_center: valueOrDefault(phaseToEdit?.work_center, selectedWorkCenter === WORK_CENTERS.BOTH ? phaseFormConfig.sections[0].fields[3].defaultValue : selectedWorkCenter),
    v_stampa: valueOrDefault(phaseToEdit?.v_stampa, phaseFormConfig.sections[1].fields[0].defaultValue),
    t_setup_stampa: valueOrDefault(phaseToEdit?.t_setup_stampa, phaseFormConfig.sections[1].fields[1].defaultValue),
    costo_h_stampa: valueOrDefault(phaseToEdit?.costo_h_stampa, phaseFormConfig.sections[1].fields[2].defaultValue),
    v_conf: valueOrDefault(phaseToEdit?.v_conf, phaseFormConfig.sections[2].fields[0].defaultValue),
    t_setup_conf: valueOrDefault(phaseToEdit?.t_setup_conf, phaseFormConfig.sections[2].fields[1].defaultValue),
    costo_h_conf: valueOrDefault(phaseToEdit?.costo_h_conf, phaseFormConfig.sections[2].fields[2].defaultValue),
    contenuto_fase: valueOrDefault(phaseToEdit?.contenuto_fase, ''),
  }), [selectedWorkCenter, phaseToEdit]);

  const handleSubmit = async (data) => {
    if (isEditMode) {
      await updatePhaseMutation.mutateAsync({ id: phaseToEdit.id, updates: data });
    } else {
      await addPhaseMutation.mutateAsync(data);
    }
    showSuccess(isEditMode ? 'Fase aggiornata con successo' : 'Fase aggiunta con successo');
  };

  return (
    <GenericForm
      config={dynamicConfig}
      initialData={initialData}
      onSubmit={handleSubmit}
      onSuccess={onSuccess}
      isEditMode={isEditMode}
    />
  );
}

export default PhasesForm;
