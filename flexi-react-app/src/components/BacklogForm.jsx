import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useProductionCalculations, useOrderValidation } from '../hooks';

function BacklogForm() {
  const initialFormData = {
    odp_number: '', article_code: '', production_lot: '', work_center: '',
    nome_cliente: '', description: '', delivery_date: '', bag_height: '',
    bag_width: '', bag_step: '', seal_sides: '3', product_type: '',
    quantity: '', quantity_per_box: '', quantity_completed: 0,
    internal_customer_code: '', external_customer_code: '',
    customer_order_ref: '', department: '', fase: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [editablePhaseParams, setEditablePhaseParams] = useState({});
  const [calculationResults, setCalculationResults] = useState(null);
  const [filteredPhases, setFilteredPhases] = useState([]);
  const [phaseSearch, setPhaseSearch] = useState('');
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Use modern hooks instead of BusinessLogicService class
  const { 
    calculateProductionMetrics, 
    autoDetermineWorkCenter, 
    autoDetermineDepartment 
  } = useProductionCalculations();
  
  const { validateOrder, validatePhaseSelection } = useOrderValidation();
  
  // Get state and actions from Zustand store
  const phases = useStore(state => state.phases);
  const addOdpOrder = useStore(state => state.addOdpOrder);

  useEffect(() => {
    // Phases are now automatically available from the store
    // No need to manually set them
  }, []);

  useEffect(() => {
    if (formData.article_code) {
      const department = autoDetermineDepartment(formData.article_code);
      const work_center = autoDetermineWorkCenter(formData.article_code);
      setFormData(prev => ({ ...prev, department, work_center, fase: '' }));
      setPhaseSearch('');
      setSelectedPhase(null);
      setEditablePhaseParams({});
      setCalculationResults(null);
    }
  }, [formData.article_code, autoDetermineDepartment, autoDetermineWorkCenter]);

  useEffect(() => {
    if (formData.department || formData.work_center) {
      const relevantPhases = phases.filter(p => 
        (!formData.department || p.department === formData.department) &&
        (!formData.work_center || p.work_center === formData.work_center)
      );
      const searchFiltered = relevantPhases.filter(p => p.name.toLowerCase().includes(phaseSearch.toLowerCase()));
      setFilteredPhases(searchFiltered);
    } else {
      setFilteredPhases([]);
    }
  }, [phaseSearch, formData.department, formData.work_center, phases]);

  const validateForm = () => {
    // Use the new validation hook
    const validationErrors = validateOrder(formData);
    
    // Additional phase validation
    if (selectedPhase) {
      const phaseErrors = validatePhaseSelection(selectedPhase, formData);
      if (phaseErrors.length > 0) {
        validationErrors.push(...phaseErrors);
      }
    } else {
      validationErrors.push('Please select a production phase');
    }

    console.log('Validation errors:', validationErrors);
    
    // Convert array of errors to object format for display
    const newErrors = {};
    validationErrors.forEach(error => {
      // Try to extract field name from error message, fallback to 'general' if can't determine
      if (error.includes('is required') || error.includes('must be greater than')) {
        // Extract field name from error message
        const fieldMatch = error.match(/^([^:]+):/);
        const fieldName = fieldMatch ? fieldMatch[1].trim().toLowerCase().replace(/\s+/g, '_') : 'general';
        newErrors[fieldName] = error;
      } else {
        newErrors.general = error;
      }
    });

    setErrors(newErrors);
    return validationErrors.length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePhaseParamChange = (field, value) => {
    setEditablePhaseParams(prev => ({ ...prev, [field]: value }));
  };

  const handlePhaseSelect = (phase) => {
    setFormData(prev => ({ ...prev, fase: phase.id }));
    setSelectedPhase(phase);
    setPhaseSearch(phase.name);
    setDropdownVisible(false);
    setCalculationResults(null);
    
    // Clear phase error
    if (errors.phase) {
      setErrors(prev => ({ ...prev, phase: '' }));
    }
    
    // Initialize editable phase parameters with current phase values
    setEditablePhaseParams({
      v_stampa: phase.v_stampa || '',
      t_setup_stampa: phase.t_setup_stampa || '',
      costo_h_stampa: phase.costo_h_stampa || '',
      v_conf: phase.v_conf || '',
      t_setup_conf: phase.t_setup_conf || '',
      costo_h_conf: phase.costo_h_conf || '',
    });
  };

  const handleCalculate = () => {
    console.log('Calculate button clicked');
    console.log('Selected phase:', selectedPhase);
    console.log('Form data:', formData);
    
    if (!selectedPhase || !formData.quantity || !formData.bag_step) {
      console.log('Validation failed:', { 
        hasPhase: !!selectedPhase, 
        hasQuantity: !!formData.quantity, 
        hasBagStep: !!formData.bag_step 
      });
      alert("Please select a phase and enter Quantity and Bag Step to calculate.");
      return;
    }
    
    // Use editable phase parameters if available, otherwise fall back to original phase values
    const phaseForCalculation = {
      ...selectedPhase,
      ...editablePhaseParams
    };
    
    console.log('Phase for calculation:', phaseForCalculation);
    const results = calculateProductionMetrics(phaseForCalculation, formData.quantity, formData.bag_step);
    console.log('Calculation results:', results);
    setCalculationResults(results);
  };

  const handleSubmit = async (e) => {
    console.log('Form submit triggered');
    e.preventDefault();
    
    console.log('Validating form...');
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    console.log('Checking calculation results...');
    if (!calculationResults) {
      console.log('No calculation results available');
      alert("Please calculate production metrics before adding to the backlog.");
      return;
    }

    console.log('Submitting form with data:', { formData, calculationResults });
    setIsSubmitting(true);
    
    try {
      const orderData = {
        ...formData,
        duration: calculationResults.totals.duration,
        cost: calculationResults.totals.cost,
        status: 'NOT SCHEDULED',
      };
      
      console.log('Calling addOdpOrder with:', orderData);
      await addOdpOrder(orderData);
      console.log('Order added successfully');
      
      // Reset form
      setFormData(initialFormData);
      setPhaseSearch('');
      setSelectedPhase(null);
      setEditablePhaseParams({});
      setCalculationResults(null);
      setErrors({});
    } catch (error) {
      console.error('Error adding order:', error);
      alert('Failed to add order. Please try again.');
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
      <h2>Create ODP</h2>
      <form onSubmit={handleSubmit}>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">🏷️ Identificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="odp_number">ODP Number *</label>
              <input 
                type="text" 
                id="odp_number" 
                name="odp_number" 
                value={formData.odp_number} 
                onChange={handleChange} 
                placeholder="ODP Number" 
                required 
                className={errors.odp_number ? 'error' : ''}
              />
              {getFieldError('odp_number')}
            </div>
            <div className="form-group">
              <label htmlFor="article_code">Article Code *</label>
              <input 
                type="text" 
                id="article_code" 
                name="article_code" 
                value={formData.article_code} 
                onChange={handleChange} 
                placeholder="Article Code" 
                required 
                className={errors.article_code ? 'error' : ''}
              />
              {getFieldError('article_code')}
            </div>
            <div className="form-group">
              <label htmlFor="production_lot">External Article Code *</label>
              <input 
                type="text" 
                id="production_lot" 
                name="production_lot" 
                value={formData.production_lot} 
                onChange={handleChange} 
                placeholder="External Article Code" 
                required 
                className={errors.production_lot ? 'error' : ''}
              />
              {getFieldError('production_lot')}
            </div>
            <div className="form-group">
              <label htmlFor="work_center">Work Center</label>
              <input 
                type="text" 
                id="work_center" 
                name="work_center" 
                value={formData.work_center} 
                onChange={handleChange} 
                placeholder="Work Center" 
                readOnly 
              />
            </div>
            <div className="form-group">
              <label htmlFor="nome_cliente">Customer Name</label>
              <input 
                type="text" 
                id="nome_cliente" 
                name="nome_cliente" 
                value={formData.nome_cliente} 
                onChange={handleChange} 
                placeholder="Customer Name" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea 
                id="description" 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                placeholder="Description" 
                rows="2"
              />
            </div>
          </div>
        </div>

        {/* SPECIFICHE TECNICHE Section */}
        <div className="form-section">
          <h3 className="section-title">🔧 Specifiche Tecniche</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="bag_height">Bag Height (mm) *</label>
              <input 
                type="number" 
                id="bag_height" 
                name="bag_height" 
                value={formData.bag_height} 
                onChange={handleChange} 
                placeholder="Bag Height" 
                min="0" 
                step="1"
                required 
                className={errors.bag_height ? 'error' : ''}
              />
              {getFieldError('bag_height')}
            </div>
            <div className="form-group">
              <label htmlFor="bag_width">Bag Width (mm) *</label>
              <input 
                type="number" 
                id="bag_width" 
                name="bag_width" 
                value={formData.bag_width} 
                onChange={handleChange} 
                placeholder="Bag Width" 
                min="0" 
                step="1"
                required 
                className={errors.bag_width ? 'error' : ''}
              />
              {getFieldError('bag_width')}
            </div>
            <div className="form-group">
              <label htmlFor="bag_step">Bag Step (mm) *</label>
              <input 
                type="number" 
                id="bag_step" 
                name="bag_step" 
                value={formData.bag_step} 
                onChange={handleChange} 
                placeholder="Bag Step" 
                min="0" 
                step="1"
                required 
                className={errors.bag_step ? 'error' : ''}
              />
              {getFieldError('bag_step')}
            </div>
            <div className="form-group">
              <label htmlFor="seal_sides">Seal Sides</label>
              <select 
                id="seal_sides" 
                name="seal_sides" 
                value={formData.seal_sides} 
                onChange={handleChange}
              >
                <option value="3">3 sides</option>
                <option value="4">4 sides</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="product_type">Product Type *</label>
              <select 
                id="product_type" 
                name="product_type" 
                value={formData.product_type} 
                onChange={handleChange} 
                required
                className={errors.product_type ? 'error' : ''}
              >
                <option value="">Select product type</option>
                <option value="crema">Crema</option>
                <option value="liquido">Liquido</option>
                <option value="polveri">Polveri</option>
              </select>
              {getFieldError('product_type')}
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Quantity *</label>
              <input 
                type="number" 
                id="quantity" 
                name="quantity" 
                value={formData.quantity} 
                onChange={handleChange} 
                placeholder="Quantity" 
                min="0" 
                step="1"
                required 
                className={errors.quantity ? 'error' : ''}
              />
              {getFieldError('quantity')}
            </div>
            <div className="form-group">
              <label htmlFor="quantity_per_box">Qty per Box</label>
              <input 
                type="number" 
                id="quantity_per_box" 
                name="quantity_per_box" 
                value={formData.quantity_per_box} 
                onChange={handleChange} 
                placeholder="Qty per Box" 
                min="0" 
                step="1"
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantity_completed">Qty Completed</label>
              <input 
                type="number" 
                id="quantity_completed" 
                name="quantity_completed" 
                value={formData.quantity_completed} 
                onChange={handleChange} 
                placeholder="Qty Completed" 
                min="0" 
                step="1"
                className={errors.quantity_completed ? 'error' : ''}
              />
              {getFieldError('quantity_completed')}
            </div>
          </div>
        </div>

        {/* DATI COMMERCIALI Section */}
        <div className="form-section">
          <h3 className="section-title">💰 Dati Commerciali</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="internal_customer_code">FLEXI Lot</label>
              <input 
                type="text" 
                id="internal_customer_code" 
                name="internal_customer_code" 
                value={formData.internal_customer_code} 
                onChange={handleChange} 
                placeholder="FLEXI Lot" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="external_customer_code">Customer Lot</label>
              <input 
                type="text" 
                id="external_customer_code" 
                name="external_customer_code" 
                value={formData.external_customer_code} 
                onChange={handleChange} 
                placeholder="Customer Lot" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="customer_order_ref">Customer Ref</label>
              <input 
                type="text" 
                id="customer_order_ref" 
                name="customer_order_ref" 
                value={formData.customer_order_ref} 
                onChange={handleChange} 
                placeholder="Customer Reference" 
              />
            </div>
          </div>
        </div>

        {/* DATI LAVORAZIONE & PIANIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">⚙️ Dati Lavorazione & Pianificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input 
                type="text" 
                id="department" 
                name="department" 
                value={formData.department} 
                onChange={handleChange} 
                placeholder="Department" 
                readOnly 
              />
            </div>
            <div className="form-group">
              <label htmlFor="phase_search">Search Production Phase *</label>
              <div className="searchable-dropdown">
                <input 
                  type="text" 
                  id="phase_search"
                  value={phaseSearch} 
                  onChange={(e) => setPhaseSearch(e.target.value)} 
                  onFocus={() => setDropdownVisible(true)} 
                  onBlur={() => setTimeout(() => setDropdownVisible(false), 150)} 
                  placeholder="Search Production Phase" 
                  required 
                  className={errors.phase ? 'error' : ''}
                />
                {getFieldError('phase')}
                {isDropdownVisible && filteredPhases.length > 0 && (
                  <div className="dropdown-options">
                    {filteredPhases.map(phase => (
                      <div 
                        key={phase.id} 
                        className="dropdown-option" 
                        onMouseDown={() => handlePhaseSelect(phase)}
                      >
                        <span className="phase-name">{phase.name}</span>
                        <span className="phase-description">{phase.contenuto_fase || 'No description'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="delivery_date">Delivery Date *</label>
              <input 
                type="datetime-local" 
                id="delivery_date" 
                name="delivery_date" 
                value={formData.delivery_date} 
                onChange={handleChange} 
                required 
                className={errors.delivery_date ? 'error' : ''}
              />
              {getFieldError('delivery_date')}
            </div>
          </div>
        </div>

        {/* Selected Phase Parameters */}
        {selectedPhase && (
          <div className="form-section">
            <h3 className="section-title">📊 Selected Phase Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              {selectedPhase.department === 'STAMPA' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="v_stampa">Print Speed:</label>
                    <input 
                      type="number" 
                      id="v_stampa"
                      value={editablePhaseParams.v_stampa || selectedPhase.v_stampa || ''} 
                      onChange={(e) => handlePhaseParamChange('v_stampa', e.target.value)}
                      placeholder="Print Speed"
                      min="0"
                    />
                    <span className="unit-label">mt/h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="t_setup_stampa">Print Setup:</label>
                    <input 
                      type="number" 
                      id="t_setup_stampa"
                      value={editablePhaseParams.t_setup_stampa || selectedPhase.t_setup_stampa || ''} 
                      onChange={(e) => handlePhaseParamChange('t_setup_stampa', e.target.value)}
                      placeholder="Setup Time"
                      min="0"
                      step="0.1"
                    />
                    <span className="unit-label">h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="costo_h_stampa">Print Cost:</label>
                    <input 
                      type="number" 
                      id="costo_h_stampa"
                      value={editablePhaseParams.costo_h_stampa || selectedPhase.costo_h_stampa || ''} 
                      onChange={(e) => handlePhaseParamChange('costo_h_stampa', e.target.value)}
                      placeholder="Hourly Cost"
                      min="0"
                      step="0.01"
                    />
                    <span className="unit-label">€/h</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="v_conf">Package Speed:</label>
                    <input 
                      type="number" 
                      id="v_conf"
                      value={editablePhaseParams.v_conf || selectedPhase.v_conf || ''} 
                      onChange={(e) => handlePhaseParamChange('v_conf', e.target.value)}
                      placeholder="Package Speed"
                      min="0"
                    />
                    <span className="unit-label">pz/h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="t_setup_conf">Package Setup:</label>
                    <input 
                      type="number" 
                      id="t_setup_conf"
                      value={editablePhaseParams.t_setup_conf || selectedPhase.t_setup_conf || ''} 
                      onChange={(e) => handlePhaseParamChange('t_setup_conf', e.target.value)}
                      placeholder="Setup Time"
                      min="0"
                      step="0.1"
                    />
                    <span className="unit-label">h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="costo_h_conf">Package Cost:</label>
                    <input 
                      type="number" 
                      id="costo_h_conf"
                      value={editablePhaseParams.costo_h_conf || selectedPhase.costo_h_conf || ''} 
                      onChange={(e) => handlePhaseParamChange('costo_h_conf', e.target.value)}
                      placeholder="Hourly Cost"
                      min="0"
                      step="0.01"
                    />
                    <span className="unit-label">€/h</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Production Calculation Results */}
        {calculationResults && (
          <div className="form-section">
            <h3 className="section-title">🧮 Production Calculation Results</h3>
            <div className="form-grid form-grid--2-cols">
              <div className="form-group">
                <label>Total Duration (hours):</label>
                <div className="result-value">{calculationResults.totals.duration.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label>Total Cost (€):</label>
                <div className="result-value">{calculationResults.totals.cost.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleCalculate} disabled={!selectedPhase}>
            Calculate
          </button>
          <button type="submit" className="btn btn-primary" disabled={!calculationResults || isSubmitting}>
            {isSubmitting ? 'Adding to Backlog...' : 'Add to Backlog'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BacklogForm;