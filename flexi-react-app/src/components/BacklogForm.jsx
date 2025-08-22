import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStore } from '../store/useStore';
import { useProductionCalculations } from '../hooks';
import {
  DEPARTMENT_TYPES,
  PRODUCT_TYPES,
  SEAL_SIDES,
  DEFAULT_VALUES,
  WORK_CENTERS
} from '../constants';

function BacklogForm({ onSuccess }) {
  const selectedWorkCenter = useStore(state => state.selectedWorkCenter);
  
  const initialFormData = {
    odp_number: '', 
    article_code: '', 
    production_lot: '', 
    work_center: selectedWorkCenter === WORK_CENTERS.BOTH ? '' : (selectedWorkCenter || ''),
    nome_cliente: '', 
    description: '', 
    delivery_date: '', 
    bag_height: '',
    bag_width: '', 
    bag_step: '', 
    seal_sides: DEFAULT_VALUES.ORDER.SEAL_SIDES, 
    product_type: '',
    quantity: '', 
    quantity_per_box: '', 
    quantity_completed: DEFAULT_VALUES.ORDER.QUANTITY_COMPLETED,
    internal_customer_code: '', 
    external_customer_code: '',
    customer_order_ref: '', 
    department: '', 
    fase: '',
  };

  const [selectedPhase, setSelectedPhase] = useState(null);
  const [editablePhaseParams, setEditablePhaseParams] = useState({});
  const [calculationResults, setCalculationResults] = useState(null);
  const [filteredPhases, setFilteredPhases] = useState([]);
  const [phaseSearch, setPhaseSearch] = useState('');
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  
  // Use modern hooks instead of BusinessLogicService class
  const { 
    calculateProductionMetrics, 
    autoDetermineWorkCenter, 
    autoDetermineDepartment 
  } = useProductionCalculations();
  
  // useOrderValidation hook not needed for this component
  
  // Get state and actions from Zustand store
  const phases = useStore(state => state.phases);
  const addOdpOrder = useStore(state => state.addOdpOrder);
  const showAlert = useStore(state => state.showAlert);

  // Define onSubmit function before useFormValidation
  const onSubmit = async (data) => {
    console.log('Form submit triggered');

    console.log('Checking calculation results...');
    if (!calculationResults) {
      console.log('No calculation results available');
      showAlert("Please calculate production metrics before adding to the backlog.", 'warning');
      return;
    }

    console.log('Submitting form with data:', { data, calculationResults });

    try {
      const orderData = {
        ...data,
        duration: calculationResults.totals.duration,
        cost: calculationResults.totals.cost,
        status: 'NOT SCHEDULED',
      };

      console.log('Calling addOdpOrder with:', orderData);
      await addOdpOrder(orderData);
      console.log('Order added successfully');

      // Call success callback to refresh the list
      if (onSuccess) {
        onSuccess();
      }

      // Reset form
      Object.keys(initialFormData).forEach(key => setValue(key, initialFormData[key]));
      setPhaseSearch('');
      setSelectedPhase(null);
      setEditablePhaseParams({});
      setCalculationResults(null);
    } catch (error) {
      // Error is already handled by the store
      console.error('Error adding order:', error);
      throw error; // Re-throw to trigger error handling
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    getValues,
    reset,
    clearErrors
  } = useForm({
    defaultValues: initialFormData
  });

  const articleCode = watch('article_code');
  const department = watch('department');
  const workCenter = watch('work_center');

  useEffect(() => {
    if (articleCode) {
      const dept = autoDetermineDepartment(articleCode);
      const wc = autoDetermineWorkCenter(articleCode);
      setValue('department', dept);
      // Only auto-set work center if BOTH is selected, otherwise keep the selected work center
      if (selectedWorkCenter === WORK_CENTERS.BOTH) {
        setValue('work_center', wc);
      }
      setValue('fase', '');
      setPhaseSearch('');
      setSelectedPhase(null);
      setEditablePhaseParams({});
      setCalculationResults(null);
    }
  }, [articleCode, autoDetermineDepartment, autoDetermineWorkCenter, setValue, selectedWorkCenter]);

  useEffect(() => {
    if (department || workCenter) {
      const relevantPhases = phases.filter(p => 
        (!department || p.department === department) &&
        (!workCenter || p.work_center === workCenter)
      );
      const searchFiltered = relevantPhases.filter(p => p.name.toLowerCase().includes(phaseSearch.toLowerCase()));
      setFilteredPhases(searchFiltered);
    } else {
      setFilteredPhases([]);
    }
  }, [phaseSearch, department, workCenter, phases]);

  const handlePhaseParamChange = (field, value) => {
    setEditablePhaseParams(prev => ({ ...prev, [field]: value }));
  };

  const handlePhaseSelect = (phase) => {
    setValue('fase', phase.id);
    setSelectedPhase(phase);
    setPhaseSearch(phase.name);
    setDropdownVisible(false);
    setCalculationResults(null);
    
    // Clear phase error
    clearErrors('phase');
    
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
    console.log('Form data:', getValues());
    
    if (!selectedPhase || !getValues('quantity') || !getValues('bag_step')) {
      console.log('Validation failed:', { 
        hasPhase: !!selectedPhase, 
        quantity: !!getValues('quantity'), 
        bagStep: !!getValues('bag_step') 
      });
      showAlert("Please select a phase and enter Quantity and Bag Step to calculate.", 'warning');
      return;
    }
    
    // Use editable phase parameters if available, otherwise fall back to original phase values
    const phaseForCalculation = {
      ...selectedPhase,
      ...editablePhaseParams
    };
    
    console.log('Phase for calculation:', phaseForCalculation);
    const results = calculateProductionMetrics(phaseForCalculation, getValues('quantity'), getValues('bag_step'));
    console.log('Calculation results:', results);
    setCalculationResults(results);
  };



  const getFieldError = (fieldName) => {
    return errors[fieldName] ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {errors[fieldName].message}
      </span>
    ) : null;
  };

  return (
    <div className="content-section">
      <h2>Create ODP</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">🏷️ Identificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="odp_number">ODP Number *</label>
              <input 
                type="text" 
                id="odp_number" 
                {...register('odp_number')}
                placeholder="ODP Number" 
                className={errors.odp_number ? 'error' : ''}
              />
              {getFieldError('odp_number')}
            </div>
            <div className="form-group">
              <label htmlFor="article_code">Article Code *</label>
              <input 
                type="text" 
                id="article_code" 
                {...register('article_code')}
                placeholder="Article Code" 
                className={errors.article_code ? 'error' : ''}
              />
              {getFieldError('article_code')}
            </div>
            <div className="form-group">
              <label htmlFor="production_lot">External Article Code *</label>
              <input 
                type="text" 
                id="production_lot" 
                {...register('production_lot')}
                placeholder="External Article Code" 
                className={errors.production_lot ? 'error' : ''}
              />
              {getFieldError('production_lot')}
            </div>
            <div className="form-group">
              <label htmlFor="work_center">Work Center</label>
              {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                <select
                  {...register('work_center', { required: 'Work center is required' })}
                  id="work_center"
                  className={errors.work_center ? 'error' : ''}
                >
                  <option value="">Select a work center</option>
                  <option value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</option>
                  <option value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</option>
                </select>
              ) : (
                <input 
                  type="text" 
                  id="work_center" 
                  value={selectedWorkCenter || 'No work center selected'}
                  disabled
                  className="disabled-input"
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              )}
              {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                errors.work_center && <span className="error-message">{errors.work_center.message}</span>
              ) : (
                <small style={{ color: '#666', fontSize: '12px' }}>
                  Work center is set based on your login selection
                </small>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="nome_cliente">Customer Name</label>
              <input 
                type="text" 
                id="nome_cliente" 
                {...register('nome_cliente')}
                placeholder="Customer Name" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea 
                id="description" 
                {...register('description')}
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
                {...register('bag_height')}
                placeholder="Bag Height" 
                min="0" 
                step="1"
                className={errors.bag_height ? 'error' : ''}
              />
              {getFieldError('bag_height')}
            </div>
            <div className="form-group">
              <label htmlFor="bag_width">Bag Width (mm) *</label>
              <input 
                type="number" 
                id="bag_width" 
                {...register('bag_width')}
                placeholder="Bag Width" 
                min="0" 
                step="1"
                className={errors.bag_width ? 'error' : ''}
              />
              {getFieldError('bag_width')}
            </div>
            <div className="form-group">
              <label htmlFor="bag_step">Bag Step (mm) *</label>
              <input 
                type="number" 
                id="bag_step" 
                {...register('bag_step')}
                placeholder="Bag Step" 
                min="0" 
                step="1"
                className={errors.bag_step ? 'error' : ''}
              />
              {getFieldError('bag_step')}
            </div>
            <div className="form-group">
              <label htmlFor="seal_sides">Seal Sides</label>
              <select 
                id="seal_sides" 
                {...register('seal_sides')}
              >
                <option value={SEAL_SIDES.THREE}>3 sides</option>
                <option value={SEAL_SIDES.FOUR}>4 sides</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="product_type">Product Type *</label>
              <select 
                id="product_type" 
                {...register('product_type')}
                className={errors.product_type ? 'error' : ''}
              >
                <option value="">Select product type</option>
                <option value={PRODUCT_TYPES.CREMA}>Crema</option>
                <option value={PRODUCT_TYPES.LIQUIDO}>Liquido</option>
                <option value={PRODUCT_TYPES.POLVERI}>Polveri</option>
              </select>
              {getFieldError('product_type')}
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Quantity *</label>
              <input 
                type="number" 
                id="quantity" 
                {...register('quantity')}
                placeholder="Quantity" 
                min="0" 
                step="1"
                className={errors.quantity ? 'error' : ''}
              />
              {getFieldError('quantity')}
            </div>
            <div className="form-group">
              <label htmlFor="quantity_per_box">Qty per Box</label>
              <input 
                type="number" 
                id="quantity_per_box" 
                {...register('quantity_per_box')}
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
                {...register('quantity_completed')}
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
                {...register('internal_customer_code')}
                placeholder="FLEXI Lot" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="external_customer_code">Customer Lot</label>
              <input 
                type="text" 
                id="external_customer_code" 
                {...register('external_customer_code')}
                placeholder="Customer Lot" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="customer_order_ref">Customer Ref</label>
              <input 
                type="text" 
                id="customer_order_ref" 
                {...register('customer_order_ref')}
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
                {...register('department')}
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
                {...register('delivery_date')}
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
              {selectedPhase.department === DEPARTMENT_TYPES.PRINTING ? (
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
          <button type="button" className="nav-btn today" onClick={handleCalculate} disabled={!selectedPhase}>
            Calculate
          </button>
          <button type="submit" className="nav-btn today" disabled={!calculationResults || isSubmitting}>
            {isSubmitting ? 'Adding to Backlog...' : 'Add to Backlog'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BacklogForm;