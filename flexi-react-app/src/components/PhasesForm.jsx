import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { usePhaseStore, useUIStore } from '../store';
import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  DEFAULT_VALUES
} from '../constants';

function PhasesForm({ phaseToEdit }) {
  const { selectedWorkCenter } = useUIStore();
  const { addPhase, updatePhase } = usePhaseStore();
  
  const isEditMode = Boolean(phaseToEdit);
  
  const initialFormData = {
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
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue
  } = useForm({
    defaultValues: initialFormData
  });

  const department = watch('department');

  // Reset packaging fields to 0 when Printing department is selected
  useEffect(() => {
    if (department === DEPARTMENT_TYPES.PRINTING) {
      setValue('v_conf', 0);
      setValue('t_setup_conf', 0);
      setValue('costo_h_conf', 0);
    }
  }, [department, setValue]);

  const getFieldError = (fieldName) => {
    return errors[fieldName] ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {errors[fieldName].message}
      </span>
    ) : null;
  };

  const onSubmit = async (data) => {
    if (isEditMode) {
      await updatePhase(phaseToEdit.id, data);
    } else {
      await addPhase(data);
    }
  };

  return (
    <div className="content-section">
      <form onSubmit={handleSubmit(onSubmit)}>
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
                className={errors.name ? 'error' : ''}
                required
              />
              {getFieldError('name')}
            </div>
            <div className="form-group">
              <label htmlFor="department">Tipo Fase *</label>
              <select 
                id="department" 
                {...register('department')}
                className={errors.department ? 'error' : ''}
              >
                <option value={DEPARTMENT_TYPES.PRINTING}>{DEPARTMENT_TYPES.PRINTING}</option>
                <option value={DEPARTMENT_TYPES.PACKAGING}>{DEPARTMENT_TYPES.PACKAGING}</option>
              </select>
              {getFieldError('department')}
            </div>
            <div className="form-group">
              <label htmlFor="numero_persone">Numero di Persone Richieste *</label>
              <input 
                type="number" 
                id="numero_persone" 
                {...register('numero_persone')}
                min="1" 
                step="1"
                className={errors.numero_persone ? 'error' : ''}
              />
              {getFieldError('numero_persone')}
            </div>
            <div className="form-group">
              <label htmlFor="work_center">Centro di Lavoro *</label>
              {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                <select
                  {...register('work_center', { required: 'Work center is required' })}
                  id="work_center"
                  className={errors.work_center ? 'error' : ''}
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
              {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                errors.work_center && <span className="error-message">{errors.work_center.message}</span>
              ) : (
                <small style={{ color: '#666', fontSize: '12px' }}>
                  Il centro di lavoro è impostato in base alla tua selezione di accesso
                </small>
              )}
            </div>
          </div>
        </div>

        {/* Conditional Printing Parameters */}
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
                  min="0" 
                  step="1"
                  className={errors.v_stampa ? 'error' : ''}
                />
                {getFieldError('v_stampa')}
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_stampa">Tempo Setup (ore)</label>
                <input 
                  type="number" 
                  id="t_setup_stampa" 
                  {...register('t_setup_stampa')}
                  min="0" 
                  step="0.1" 
                  className={errors.t_setup_stampa ? 'error' : ''}
                />
                {getFieldError('t_setup_stampa')}
              </div>
              <div className="form-group">
                <label htmlFor="costo_h_stampa">Costo Orario (€/h)</label>
                <input 
                  type="number" 
                  id="costo_h_stampa" 
                  {...register('costo_h_stampa')}
                  min="0" 
                  step="0.01" 
                  className={errors.costo_h_stampa ? 'error' : ''}
                />
                {getFieldError('costo_h_stampa')}
              </div>
            </div>
          </div>
        )}

        {/* Conditional Packaging Parameters */}
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
                  min="0" 
                  step="1"
                  className={errors.v_conf ? 'error' : ''}
                />
                {getFieldError('v_conf')}
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_conf">Tempo Setup (ore)</label>
                <input 
                  type="number" 
                  id="t_setup_conf" 
                  {...register('t_setup_conf')}
                  min="0" 
                  step="0.1" 
                  className={errors.t_setup_conf ? 'error' : ''}
                />
                {getFieldError('t_setup_conf')}
              </div>
              <div className="form-group">
                <label htmlFor="costo_h_conf">Costo Orario (€/h)</label>
                <input 
                  type="number" 
                  id="costo_h_conf" 
                  {...register('costo_h_conf')}
                  min="0" 
                  step="0.01" 
                  className={errors.costo_h_conf ? 'error' : ''}
                />
                {getFieldError('costo_h_conf')}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="contenuto_fase">Descrizione Contenuto Fase</label>
              <textarea 
                id="contenuto_fase" 
                {...register('contenuto_fase')}
                rows="3"
                placeholder="Descrivi il contenuto della fase e i requisiti..."
              />
            </div>
          </div>
        )}

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
