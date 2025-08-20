import React from 'react';
import { useStore } from '../store/useStore';
import { useFormValidation } from '../hooks';
import { 
  DEPARTMENT_TYPES, 
  WORK_CENTERS, 
  DEFAULT_VALUES 
} from '../constants';

function PhasesForm() {
  const initialFormData = {
    name: '',
    department: DEFAULT_VALUES.PHASE.DEPARTMENT,
    numero_persone: DEFAULT_VALUES.PHASE.NUMERO_PERSONE,
    work_center: DEFAULT_VALUES.PHASE.WORK_CENTER,
    v_stampa: DEFAULT_VALUES.PHASE.V_STAMPA,
    t_setup_stampa: DEFAULT_VALUES.PHASE.T_SETUP_STAMPA,
    costo_h_stampa: DEFAULT_VALUES.PHASE.COSTO_H_STAMPA,
    v_conf: DEFAULT_VALUES.PHASE.V_CONF,
    t_setup_conf: DEFAULT_VALUES.PHASE.T_SETUP_CONF,
    costo_h_conf: DEFAULT_VALUES.PHASE.COSTO_H_CONF,
    contenuto_fase: '',
  };
  
  // Get addPhase action from Zustand store
  const addPhase = useStore(state => state.addPhase);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useFormValidation('PHASE', initialFormData, addPhase);

  const department = watch('department');

  const getFieldError = (fieldName) => {
    return errors[fieldName] ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {errors[fieldName].message}
      </span>
    ) : null;
  };

  return (
    <div className="content-section">
      <h2>Production Phases</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3 className="section-title">➕ Add New Phase</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group">
              <label htmlFor="name">Phase Name *</label>
              <input 
                type="text" 
                id="name" 
                {...register('name')}
                placeholder="e.g., High-Speed Printing" 
                className={errors.name ? 'error' : ''}
              />
              {getFieldError('name')}
            </div>
            <div className="form-group">
              <label htmlFor="department">Phase Type *</label>
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
              <label htmlFor="numero_persone">Number of People Required *</label>
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
              <label htmlFor="work_center">Work Center *</label>
              <select 
                id="work_center" 
                {...register('work_center')}
                className={errors.work_center ? 'error' : ''}
              >
                <option value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</option>
                <option value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</option>
              </select>
              {getFieldError('work_center')}
            </div>
          </div>
        </div>

        {/* Conditional Printing Parameters */}
        {department === DEPARTMENT_TYPES.PRINTING && (
          <div className="form-section">
            <h3 className="section-title">🖨️ Printing Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_stampa">Printing Speed (mt/h) *</label>
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
                <label htmlFor="t_setup_stampa">Setup Time (hours)</label>
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
                <label htmlFor="costo_h_stampa">Hourly Cost (€/h)</label>
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
            <h3 className="section-title">📦 Packaging Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_conf">Packaging Speed (pz/h) *</label>
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
                <label htmlFor="t_setup_conf">Setup Time (hours)</label>
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
                <label htmlFor="costo_h_conf">Hourly Cost (€/h)</label>
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
              <label htmlFor="contenuto_fase">Phase Content Description</label>
              <textarea 
                id="contenuto_fase" 
                {...register('contenuto_fase')}
                rows="3"
                placeholder="Describe the phase content and requirements..."
              />
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding Phase...' : 'Add Phase'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PhasesForm;
