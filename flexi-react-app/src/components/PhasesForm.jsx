import React, { useEffect, useMemo } from 'react';
import { useUIStore } from '../store';
import { useErrorHandler, useAddPhase, useUpdatePhase } from '../hooks';
import { showSuccess } from '../utils';
import { WORK_CENTERS, DEPARTMENT_TYPES } from '../constants';
import GenericForm from './GenericForm';
import { phaseFormConfig } from './formConfigs';

function PhasesForm({ phaseToEdit, onSuccess }) {
  const { selectedWorkCenter } = useUIStore();
  
  // React Query mutations
  const addPhaseMutation = useAddPhase();
  const updatePhaseMutation = useUpdatePhase();
  
  const { handleAsync } = useErrorHandler('PhasesForm');
  
  const isEditMode = Boolean(phaseToEdit);
  
  // Create dynamic config based on selected work center
  const dynamicConfig = useMemo(() => {
    const config = { ...phaseFormConfig };
    
    // Update work center field based on selected work center
    if (selectedWorkCenter !== WORK_CENTERS.BOTH) {
      config.sections[0].fields[3].disabled = true;
      config.sections[0].fields[3].defaultValue = selectedWorkCenter;
      config.sections[0].fields[3].helpText = 'Il centro di lavoro è impostato in base alla tua selezione di accesso';
    }
    
    return config;
  }, [selectedWorkCenter]);

  const initialData = useMemo(() => ({
    name: phaseToEdit?.name || '',
    department: phaseToEdit?.department || phaseFormConfig.sections[0].fields[1].defaultValue,
    numero_persone: phaseToEdit?.numero_persone || phaseFormConfig.sections[0].fields[2].defaultValue,
    work_center: phaseToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? phaseFormConfig.sections[0].fields[3].defaultValue : selectedWorkCenter),
    v_stampa: phaseToEdit?.v_stampa || phaseFormConfig.sections[1].fields[0].defaultValue,
    t_setup_stampa: phaseToEdit?.t_setup_stampa || phaseFormConfig.sections[1].fields[1].defaultValue,
    costo_h_stampa: phaseToEdit?.costo_h_stampa || phaseFormConfig.sections[1].fields[2].defaultValue,
    v_conf: phaseToEdit?.v_conf || phaseFormConfig.sections[2].fields[0].defaultValue,
    t_setup_conf: phaseToEdit?.t_setup_conf || phaseFormConfig.sections[2].fields[1].defaultValue,
    costo_h_conf: phaseToEdit?.costo_h_conf || phaseFormConfig.sections[2].fields[2].defaultValue,
    contenuto_fase: phaseToEdit?.contenuto_fase || '',
  }), [selectedWorkCenter, phaseToEdit]);

  const handleSubmit = async (data) => {
    await handleAsync(
      async () => {
        if (isEditMode) {
          await updatePhaseMutation.mutateAsync({ id: phaseToEdit.id, updates: data });
        } else {
          await addPhaseMutation.mutateAsync(data);
        }
        if (onSuccess) {
          onSuccess();
        }
        showSuccess(isEditMode ? 'Fase aggiornata con successo' : 'Fase aggiunta con successo');
      },
      { 
        context: isEditMode ? 'Update Phase' : 'Add Phase', 
        fallbackMessage: isEditMode ? 'Aggiornamento fase fallito' : 'Aggiunta fase fallita'
      }
    );
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