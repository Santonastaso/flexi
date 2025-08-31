import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { usePhaseStore, useUIStore } from '../store';
import { useErrorHandler } from '../hooks';
import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  DEFAULT_VALUES
} from '../constants';

// --- Reusable Helper Function ---
// This function contains the logic that was previously duplicated.
const validateNumericFields = (data, fieldsToValidate) => {
  const errors = [];
  fieldsToValidate.forEach(({ field, name }) => {
    const value = data[field];
    if (value === '' || value === null || value === undefined) {
      errors.push(`${name} is required`);
    } else if (Number(value) < 0) {
      errors.push(`${name} cannot be negative`);
    }
  });
  return errors;
};

// --- Constants for Validation ---
// Defined outside the component so they are not re-created on every render.
const PRINTING_FIELDS = [
  { field: 'v_stampa', name: 'V Stampa' },
  { field: 't_setup_stampa', name: 'T Setup Stampa' },
  { field: 'costo_h_stampa', name: 'Costo H Stampa' }
];

const PACKAGING_FIELDS = [
  { field: 'v_conf', name: 'V Conf' },
  { field: 't_setup_conf', name: 'T Setup Conf' },
  { field: 'costo_h_conf', name: 'Costo H Conf' }
];

function PhasesForm({ phaseToEdit, onSuccess }) {
  const { selectedWorkCenter, showAlert } = useUIStore();
  const { addPhase, updatePhase } = usePhaseStore();
  const { handleAsync } = useErrorHandler('PhasesForm');
  
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
    // --- Streamlined Validation Logic ---
    let validationErrors = [];
    
    // Required fields
    if (!data.name?.trim()) validationErrors.push('Nome Fase is required');
    if (!data.department?.trim()) validationErrors.push('Department is required');
    if (!data.work_center?.trim()) validationErrors.push('Work Center is required');
    if (!data.numero_persone || data.numero_persone < 1) validationErrors.push('Numero Persone must be at least 1');
    if (!data.contenuto_fase?.trim()) validationErrors.push('Contenuto Fase is required');
    
    // Use the helper for department-specific validation
    if (data.department === DEPARTMENT_TYPES.PRINTING) {
      validationErrors.push(...validateNumericFields(data, PRINTING_FIELDS));
    }
    
    if (data.department === DEPARTMENT_TYPES.PACKAGING) {
      validationErrors.push(...validateNumericFields(data, PACKAGING_FIELDS));
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
      },
      { 
        context: isEditMode ? 'Update Phase' : 'Add Phase', 
        fallbackMessage: isEditMode ? 'Aggiornamento fase fallito' : 'Aggiunta fase fallita'
      }
    );
  };

  return (
    <div className="content-section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-section">
          <h3 className="section-title">Informazioni Fase</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group">
              <label htmlFor="name">Nome Fase *</label>
              <input 
                type="text" 
                id="name" 
                {...register('name')}
                placeholder="es. Stampa Alta Velocità" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="department">Tipo Fase *</label>
              <select 
                id="department" 
                {...register('department')}
              >
                <option value={DEPARTMENT_TYPES.PRINTING}>{DEPARTMENT_TYPES.PRINTING}</option>
                <option value={DEPARTMENT_TYPES.PACKAGING}>{DEPARTMENT_TYPES.PACKAGING}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="numero_persone">Numero di Persone Richieste *</label>
              <input 
                type="number" 
                id="numero_persone" 
                {...register('numero_persone')}
              />
            </div>
            <div className="form-group">
              <label htmlFor="work_center">Centro di Lavoro *</label>
              {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                <select
                  {...register('work_center')}
                  id="work_center"
                >
                  <option value="">Seleziona un centro di lavoro</option>
                  <option value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</option>
                  <option value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</option>
                </select>
              ) : (
                <input
                  type="text"
                  id="work_center"
                  value={selectedWorkCenter || 'Nessun centro di lavoro selezionato'}
                  disabled
                  className="disabled-input"
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              )}
              {selectedWorkCenter !== WORK_CENTERS.BOTH && (
                <small style={{ color: '#666', fontSize: '12px' }}>
                  Il centro di lavoro è impostato in base alla tua selezione di accesso
                </small>
              )}
            </div>
          </div>
        </div>

        {department === DEPARTMENT_TYPES.PRINTING && (
          <div className="form-section">
            <h3 className="section-title">Parametri Stampa</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_stampa">Velocità Stampa (mt/h) *</label>
                <input 
                  type="number" 
                  id="v_stampa" 
                  {...register('v_stampa')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_stampa">Tempo Setup (ore) *</label>
                <input 
                  type="number" 
                  id="t_setup_stampa" 
                  {...register('t_setup_stampa')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="costo_h_stampa">Costo Orario (€/h) *</label>
                <input 
                  type="number" 
                  id="costo_h_stampa" 
                  {...register('costo_h_stampa')}
                />
              </div>
            </div>
          </div>
        )}

        {department === DEPARTMENT_TYPES.PACKAGING && (
          <div className="form-section">
            <h3 className="section-title">Parametri Confezionamento</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_conf">Velocità Confezionamento (pz/h) *</label>
                <input 
                  type="number" 
                  id="v_conf" 
                  {...register('v_conf')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_conf">Tempo Setup (ore) *</label>
                <input 
                  type="number" 
                  id="t_setup_conf" 
                  {...register('t_setup_conf')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="costo_h_conf">Costo Orario (€/h) *</label>
                <input 
                  type="number" 
                  id="costo_h_conf" 
                  {...register('costo_h_conf')}
                />
              </div>
            </div>
          </div>
        )}

        <div className="form-section">
          <h3 className="section-title">Descrizione Fase</h3>
          <div className="form-group">
            <label htmlFor="contenuto_fase">Descrizione Contenuto Fase *</label>
            <textarea 
              id="contenuto_fase" 
              {...register('contenuto_fase')}
              rows="3"
              placeholder="Descrivi il contenuto della fase e i requisiti..."
            />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button 
            type="submit" 
            className="nav-btn today" 
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isEditMode ? 'Aggiornamento Fase...' : 'Aggiunta Fase...') 
              : (isEditMode ? 'Aggiorna Fase' : 'Aggiungi Fase')
            }
          </button>
        </div>
      </form>
    </div>
  );
}

export default PhasesForm;