import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { validation } from '../utils';

function PhasesForm() {
  const initialFormData = {
    name: '',
    department: 'STAMPA',
    numero_persone: 1,
    work_center: 'ZANICA',
    v_stampa: 6000,
    t_setup_stampa: 0.5,
    costo_h_stampa: 50,
    v_conf: 1000,
    t_setup_conf: 0.25,
    costo_h_conf: 40,
    contenuto_fase: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get addPhase action from Zustand store
  const addPhase = useStore(state => state.addPhase);

  // Reset errors when department changes
  useEffect(() => {
    setErrors({});
  }, [formData.department]);

  const validateForm = () => {
    const newErrors = {};

    // Required field validation using utility functions
    if (!validation.isNotEmpty(formData.name)) {
      newErrors.name = 'Phase name is required';
    }

    if (!validation.isValidDepartment(formData.department)) {
      newErrors.department = 'Department is required';
    }

    if (!validation.isValidWorkCenter(formData.work_center)) {
      newErrors.work_center = 'Work center is required';
    }

    if (!validation.isValidInteger(formData.numero_persone, 1)) {
      newErrors.numero_persone = 'Number of people must be at least 1';
    }

    // Department-specific validation
    if (formData.department === 'STAMPA') {
      if (!validation.isValidNumber(formData.v_stampa, 0)) {
        newErrors.v_stampa = 'Printing speed must be greater than 0';
      }
      if (!validation.isValidNumber(formData.t_setup_stampa, 0)) {
        newErrors.t_setup_stampa = 'Setup time cannot be negative';
      }
      if (!validation.isValidNumber(formData.costo_h_stampa, 0)) {
        newErrors.costo_h_stampa = 'Hourly cost cannot be negative';
      }
    }

    if (formData.department === 'CONFEZIONAMENTO') {
      if (!validation.isValidNumber(formData.v_conf, 0)) {
        newErrors.v_conf = 'Packaging speed must be greater than 0';
      }
      if (!validation.isValidNumber(formData.t_setup_conf, 0)) {
        newErrors.t_setup_conf = 'Setup time cannot be negative';
      }
      if (!validation.isValidNumber(formData.costo_h_conf, 0)) {
        newErrors.costo_h_conf = 'Hourly cost cannot be negative';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const parsedValue = type === 'number' ? parseFloat(value) || 0 : value;
    
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await addPhase(formData);
      setFormData(initialFormData); // Reset form
      setErrors({}); // Clear errors
    } catch (error) {
      console.error('Error adding phase:', error);
      // You could add a toast notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldError = (fieldName) => {
    return errors[fieldName] ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {errors[fieldName]}
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
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="e.g., High-Speed Printing" 
                required 
                className={errors.name ? 'error' : ''}
              />
              {getFieldError('name')}
            </div>
            <div className="form-group">
              <label htmlFor="department">Phase Type *</label>
              <select 
                id="department" 
                name="department" 
                value={formData.department} 
                onChange={handleChange} 
                required
                className={errors.department ? 'error' : ''}
              >
                <option value="STAMPA">STAMPA</option>
                <option value="CONFEZIONAMENTO">CONFEZIONAMENTO</option>
              </select>
              {getFieldError('department')}
            </div>
            <div className="form-group">
              <label htmlFor="numero_persone">Number of People Required *</label>
              <input 
                type="number" 
                id="numero_persone" 
                name="numero_persone" 
                value={formData.numero_persone} 
                onChange={handleChange} 
                min="1" 
                required 
                className={errors.numero_persone ? 'error' : ''}
              />
              {getFieldError('numero_persone')}
            </div>
            <div className="form-group">
              <label htmlFor="work_center">Work Center *</label>
              <select 
                id="work_center" 
                name="work_center" 
                value={formData.work_center} 
                onChange={handleChange} 
                required
                className={errors.work_center ? 'error' : ''}
              >
                <option value="ZANICA">ZANICA</option>
                <option value="BUSTO_GAROLFO">BUSTO GAROLFO</option>
              </select>
              {getFieldError('work_center')}
            </div>
          </div>
        </div>

        {/* Conditional Printing Parameters */}
        {formData.department === 'STAMPA' && (
          <div className="form-section">
            <h3 className="section-title">🖨️ Printing Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_stampa">Printing Speed (mt/h) *</label>
                <input 
                  type="number" 
                  id="v_stampa" 
                  name="v_stampa" 
                  value={formData.v_stampa} 
                  onChange={handleChange} 
                  min="0" 
                  step="100"
                  className={errors.v_stampa ? 'error' : ''}
                />
                {getFieldError('v_stampa')}
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_stampa">Setup Time (hours)</label>
                <input 
                  type="number" 
                  id="t_setup_stampa" 
                  name="t_setup_stampa" 
                  value={formData.t_setup_stampa} 
                  onChange={handleChange} 
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
                  name="costo_h_stampa" 
                  value={formData.costo_h_stampa} 
                  onChange={handleChange} 
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
        {formData.department === 'CONFEZIONAMENTO' && (
          <div className="form-section">
            <h3 className="section-title">📦 Packaging Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_conf">Packaging Speed (pz/h) *</label>
                <input 
                  type="number" 
                  id="v_conf" 
                  name="v_conf" 
                  value={formData.v_conf} 
                  onChange={handleChange} 
                  min="0" 
                  step="100"
                  className={errors.v_conf ? 'error' : ''}
                />
                {getFieldError('v_conf')}
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_conf">Setup Time (hours)</label>
                <input 
                  type="number" 
                  id="t_setup_conf" 
                  name="t_setup_conf" 
                  value={formData.t_setup_conf} 
                  onChange={handleChange} 
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
                  name="costo_h_conf" 
                  value={formData.costo_h_conf} 
                  onChange={handleChange} 
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
                name="contenuto_fase" 
                value={formData.contenuto_fase} 
                onChange={handleChange} 
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
