import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { usePhaseStore, useUIStore } from '../store';
import { useErrorHandler, useValidation } from '../hooks';
import { showValidationError, showSuccess } from '../utils';
import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  DEFAULT_VALUES
} from '../constants';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from './ui';



function PhasesForm({ phaseToEdit, onSuccess }) {
  const { selectedWorkCenter } = useUIStore();
  const { addPhase, updatePhase } = usePhaseStore();
  const { handleAsync } = useErrorHandler('PhasesForm');
  const { validatePhase } = useValidation();
  
  const isEditMode = Boolean(phaseToEdit);
  
  const initialFormData = useMemo(() => ({
    name: phaseToEdit?.name || '',
    department: phaseToEdit?.department || DEFAULT_VALUES.PHASE.DEPARTMENT,
    numero_persone: phaseToEdit?.numero_persone || DEFAULT_VALUES.PHASE.NUMERO_PERSONE,
    work_center: phaseToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? DEFAULT_VALUES.PHASE.WORK_CENTER : selectedWorkCenter),
    v_stampa: phaseToEdit?.v_stampa || DEFAULT_VALUES.PHASE.V_STAMPA,
    t_setup_stampa: phaseToEdit?.t_setup_stampa || DEFAULT_VALUES.PHASE.T_SETUP_STAMPA,
    costo_h_stampa: phaseToEdit?.costo_h_stampa || DEFAULT_VALUES.PHASE.COSTO_H_STAMPA,
    v_conf: phaseToEdit?.v_conf || DEFAULT_VALUES.PHASE.V_CONF,
    t_setup_conf: phaseToEdit?.t_setup_conf || DEFAULT_VALUES.PHASE.T_SETUP_CONF,
    costo_h_conf: phaseToEdit?.costo_h_conf || DEFAULT_VALUES.PHASE.COSTO_H_CONF,
    contenuto_fase: phaseToEdit?.contenuto_fase || '',
  }), [selectedWorkCenter, phaseToEdit]);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    watch,
    setValue,
    reset
  } = useForm({
    defaultValues: initialFormData
  });

  const department = watch('department');

  useEffect(() => {
    if (department === DEPARTMENT_TYPES.PRINTING) {
      setValue('v_conf', 0);
      setValue('t_setup_conf', 0);
      setValue('costo_h_conf', 0);
    }
  }, [department, setValue]);

  const onSubmit = async (data) => {
    // --- Validation Logic ---
    const validation = validatePhase(data);
    
    if (!validation.isValid) {
      showValidationError(Object.values(validation.errors));
      return;
    }
    
    if (validationErrors.length > 0) {
      showAlert(`Validation errors:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    // --- Submission Logic ---
    await handleAsync(
      async () => {
        if (isEditMode) {
          await updatePhase(phaseToEdit.id, data);
        } else {
          await addPhase(data);
        }
        if (onSuccess) {
          onSuccess();
        }
        reset(initialFormData);
        showSuccess(isEditMode ? 'Fase aggiornata con successo' : 'Fase aggiunta con successo');
      },
      { 
        context: isEditMode ? 'Update Phase' : 'Add Phase', 
        fallbackMessage: isEditMode ? 'Aggiornamento fase fallito' : 'Aggiunta fase fallita'
      }
    );
  };

  return (
    <div className="p-2 bg-white rounded-lg shadow-sm border">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <div className="space-y-3">
                       <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Informazioni Fase</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Fase *</Label>
              <Input 
                type="text" 
                id="name" 
                {...register('name')}
                placeholder="es. Stampa Alta Velocità" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Tipo Fase *</Label>
              <Select onValueChange={(value) => setValue('department', value)} defaultValue={watch('department')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo fase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEPARTMENT_TYPES.PRINTING}>{DEPARTMENT_TYPES.PRINTING}</SelectItem>
                  <SelectItem value={DEPARTMENT_TYPES.PACKAGING}>{DEPARTMENT_TYPES.PACKAGING}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_persone">Numero di Persone Richieste *</Label>
              <Input 
                type="number" 
                id="numero_persone" 
                {...register('numero_persone')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_center">Centro di Lavoro *</Label>
              {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                <Select onValueChange={(value) => setValue('work_center', value)} defaultValue={watch('work_center')}>
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
                  type="text"
                  id="work_center"
                  value={selectedWorkCenter || 'Nessun centro di lavoro selezionato'}
                  disabled
                  className="bg-gray-50"
                />
              )}
              {selectedWorkCenter !== WORK_CENTERS.BOTH && (
                                 <p className="text-xs text-gray-500">
                  Il centro di lavoro è impostato in base alla tua selezione di accesso
                </p>
              )}
            </div>
          </div>
        </div>

        {department === DEPARTMENT_TYPES.PRINTING && (
          <div className="space-y-3">
                         <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Parametri Stampa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v_stampa">Velocità Stampa (mt/h) *</Label>
                <Input 
                  type="number" 
                  id="v_stampa" 
                  {...register('v_stampa')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t_setup_stampa">Tempo Setup (ore) *</Label>
                <Input 
                  type="number" 
                  id="t_setup_stampa" 
                  {...register('t_setup_stampa')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costo_h_stampa">Costo Orario (€/h) *</Label>
                <Input 
                  type="number" 
                  id="costo_h_stampa" 
                  {...register('costo_h_stampa')}
                />
              </div>
            </div>
          </div>
        )}

        {department === DEPARTMENT_TYPES.PACKAGING && (
          <div className="space-y-3">
                         <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Parametri Confezionamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v_conf">Velocità Confezionamento (pz/h) *</Label>
                <Input 
                  type="number" 
                  id="v_conf" 
                  {...register('v_conf')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t_setup_conf">Tempo Setup (ore) *</Label>
                <Input 
                  type="number" 
                  id="t_setup_conf" 
                  {...register('t_setup_conf')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costo_h_conf">Costo Orario (€/h) *</Label>
                <Input 
                  type="number" 
                  id="costo_h_conf" 
                  {...register('costo_h_conf')}
                />
              </div>
            </div>
          </div>
        )}
  
          <div className="space-y-3">
                       <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Descrizione Fase</h3>
          <div className="space-y-2">
            <Label htmlFor="contenuto_fase">Descrizione Contenuto Fase *</Label>
            <textarea 
              id="contenuto_fase" 
              {...register('contenuto_fase')}
              rows="3"
              placeholder="Descrivi il contenuto della fase e i requisiti..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isEditMode ? 'Aggiornamento Fase...' : 'Aggiunta Fase...') 
              : (isEditMode ? 'Aggiorna Fase' : 'Aggiungi Fase')
            }
          </Button>
        </div>
      </form>
    </div>
  );
}

export default PhasesForm;