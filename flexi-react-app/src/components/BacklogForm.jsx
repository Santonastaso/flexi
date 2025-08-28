import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useOrderStore, useUIStore, useSchedulerStore } from '../store';
import { useProductionCalculations } from '../hooks/useProductionCalculations';
import { usePhaseSearch } from '../hooks/usePhaseSearch';
import { DEPARTMENT_TYPES, WORK_CENTERS, DEFAULT_VALUES, SEAL_SIDES, PRODUCT_TYPES } from '../constants';
import { useErrorHandler } from '../hooks';

const BacklogForm = ({ onSuccess, orderToEdit }) => {
  const { addOdpOrder, updateOdpOrder } = useOrderStore();
  const { showAlert, selectedWorkCenter, showConflictDialog } = useUIStore();
  const { scheduleTask } = useSchedulerStore();
  const { calculateProductionMetrics, validatePhaseParameters, autoDetermineWorkCenter, autoDetermineDepartment } = useProductionCalculations();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('BacklogForm');
  
  const [calculationResults, setCalculationResults] = useState(null);
  
  const isEditMode = Boolean(orderToEdit);
  
  // Memoize initialFormData to prevent unnecessary re-renders
  const initialFormData = useMemo(() => ({
    odp_number: orderToEdit?.odp_number || '', 
    article_code: orderToEdit?.article_code || '', 
    production_lot: orderToEdit?.production_lot || '', 
    work_center: orderToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? '' : (selectedWorkCenter || '')),
    nome_cliente: orderToEdit?.nome_cliente || '', 
    description: orderToEdit?.description || '', 
    delivery_date: orderToEdit?.delivery_date || '', 
    bag_height: orderToEdit?.bag_height || '',
    bag_width: orderToEdit?.bag_width || '', 
    bag_step: orderToEdit?.bag_step || '', 
    seal_sides: orderToEdit?.seal_sides || DEFAULT_VALUES.ORDER.SEAL_SIDES, 
    product_type: orderToEdit?.product_type || '',
    quantity: orderToEdit?.quantity || '', 
    quantity_per_box: orderToEdit?.quantity_per_box || '', 
    quantity_completed: orderToEdit?.quantity_completed || DEFAULT_VALUES.ORDER.QUANTITY_COMPLETED,
    internal_customer_code: orderToEdit?.internal_customer_code || '', 
    external_customer_code: orderToEdit?.external_customer_code || '',
    customer_order_ref: orderToEdit?.customer_order_ref || '', 
    department: orderToEdit?.department || '', 
    fase: orderToEdit?.fase || '',
  }), [selectedWorkCenter, orderToEdit]);

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

  // Use the extracted phase search hook
  const {
    phaseSearch,
    setPhaseSearch,
    isDropdownVisible,
    setIsDropdownVisible,
    selectedPhase,
    setSelectedPhase,
    filteredPhases,
    editablePhaseParams,
    setEditablePhaseParams,
    handlePhaseParamChange,
    handlePhaseSelect,
    handleBlur
  } = usePhaseSearch(department, workCenter);

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
      // Reset phase data directly instead of calling the function from the hook
      setPhaseSearch('');
      setSelectedPhase(null);
      setEditablePhaseParams({});
      setCalculationResults(null);
    }
  }, [articleCode, autoDetermineDepartment, autoDetermineWorkCenter, setValue, selectedWorkCenter]);

  // Define onSubmit function before useFormValidation
  const onSubmit = async (data) => {
    if (!calculationResults || !calculationResults.totals) {
      showAlert("Calcola le metriche di produzione prima di aggiungere al backlog.", 'warning');
      return;
    }

    if (typeof calculationResults.totals.duration !== 'number' || typeof calculationResults.totals.cost !== 'number') {
      showAlert("Risultati del calcolo non validi. Ricalcola le metriche di produzione.", 'error');
      return;
    }

    await handleAsync(
      async () => {
        const orderData = {
          ...data,
          duration: calculationResults.totals.duration,
          cost: calculationResults.totals.cost,
          status: isEditMode ? orderToEdit.status : 'NOT SCHEDULED',
        };

        let updatedOrder = null;
        if (isEditMode) {
          updatedOrder = await updateOdpOrder(orderToEdit.id, orderData);
        } else {
          updatedOrder = await addOdpOrder(orderData);
        }

        // If the order is scheduled, re-validate the schedule with the new duration
        if (isEditMode && updatedOrder?.scheduled_machine_id && updatedOrder?.scheduled_start_time) {
          const startDate = new Date(updatedOrder.scheduled_start_time);
          const durationHours = updatedOrder.time_remaining || updatedOrder.duration || calculationResults.totals.duration || 1;
          const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

          const scheduleData = {
            machine: updatedOrder.scheduled_machine_id,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
          };

          const result = await scheduleTask(updatedOrder.id, scheduleData);
          if (result?.conflict) {
            showConflictDialog(result);
          } else if (result?.error) {
            showAlert(result.error, 'error');
          }
        }

        // Call success callback to refresh the list if provided
        if (onSuccess) {
          onSuccess();
        }

        // Use react-hook-form's reset function instead of manual reset
        reset(initialFormData);
        // Reset phase data directly instead of calling the function from the hook
        setPhaseSearch('');
        setSelectedPhase(null);
        setEditablePhaseParams({});
        setCalculationResults(null);
      },
      { 
        context: isEditMode ? 'Update Order' : 'Add Order', 
        fallbackMessage: isEditMode ? 'Aggiornamento ordine fallito' : 'Aggiunta ordine al backlog fallita'
      }
    );
  };

  const handlePhaseSelectWrapper = (phase) => {
    handlePhaseSelect(phase, setValue, clearErrors);
    setCalculationResults(null);
  };

  const handleCalculate = () => {
    
    if (!selectedPhase || !getValues('quantity') || !getValues('bag_step')) {
      showAlert("Seleziona una fase e inserisci Quantità e Passo Busta per calcolare.", 'warning');
      return;
    }
    
    // Use editable phase parameters if available, otherwise fall back to original phase values
    const phaseForCalculation = {
      ...selectedPhase,
      ...editablePhaseParams
    };
    
    // Validate phase parameters first
    const validation = validatePhaseParameters(phaseForCalculation);
    if (!validation.isValid) {
      showAlert(validation.error, 'error');
      setCalculationResults(null);
      return;
    }
    
    const results = calculateProductionMetrics(phaseForCalculation, getValues('quantity'), getValues('bag_step'));
    
    if (!results) {
      showAlert("Errore nel calcolo. Verifica che tutti i parametri della fase siano impostati correttamente.", 'error');
      setCalculationResults(null);
      return;
    }
    
    if (typeof results.totals?.duration !== 'number' || typeof results.totals?.cost !== 'number') {
      showAlert("Risultati del calcolo non validi. Verifica i parametri della fase.", 'error');
      setCalculationResults(null);
      return;
    }
    
    setCalculationResults(results);
  };

  const getFieldError = (fieldName) => {
    return errors[fieldName] ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {errors[fieldName].message}
      </span>
    ) : null;
  };

  // Helper function to get input value for phase parameters
  const getPhaseParamValue = (paramName) => {
    const editableValue = editablePhaseParams[paramName];
    const originalValue = selectedPhase[paramName];
    
    if (editableValue !== null && editableValue !== undefined) {
      return editableValue;
    }
    return originalValue || '';
  };

  return (
    <div className="content-section">
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">Identificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="odp_number">ODP Number *</label>
              <input 
                type="text" 
                id="odp_number" 
                {...register('odp_number', { required: 'ODP Number is required' })}
                placeholder="Numero ODP" 
                className={errors.odp_number ? 'error' : ''}
              />
              {getFieldError('odp_number')}
            </div>
            <div className="form-group">
              <label htmlFor="article_code">Article Code *</label>
              <input 
                type="text" 
                id="article_code" 
                {...register('article_code', { required: 'Article Code is required' })}
                placeholder="Codice Articolo" 
                className={errors.article_code ? 'error' : ''}
              />
              {getFieldError('article_code')}
            </div>
            <div className="form-group">
              <label htmlFor="production_lot">External Article Code *</label>
              <input 
                type="text" 
                id="production_lot" 
                {...register('production_lot', { required: 'External Article Code is required' })}
                placeholder="Codice Articolo Esterno" 
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
            <div className="form-group">
              <label htmlFor="nome_cliente">Customer Name</label>
              <input 
                type="text" 
                id="nome_cliente" 
                {...register('nome_cliente')}
                placeholder="Nome Cliente" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea 
                id="description" 
                {...register('description')}
                placeholder="Descrizione" 
                rows="2"
              />
            </div>
          </div>
        </div>

        {/* SPECIFICHE TECNICHE Section */}
        <div className="form-section">
          <h3 className="section-title">Specifiche Tecniche</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="bag_height">Bag Height (mm) *</label>
              <input 
                type="number" 
                id="bag_height" 
                {...register('bag_height', { required: 'Bag Height is required', min: { value: 0, message: 'Bag Height must be at least 0' } })}
                placeholder="Altezza Busta" 
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
                {...register('bag_width', { required: 'Bag Width is required', min: { value: 0, message: 'Bag Width must be at least 0' } })}
                placeholder="Larghezza Busta" 
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
                {...register('bag_step', { required: 'Bag Step is required', min: { value: 0, message: 'Bag Step must be at least 0' } })}
                placeholder="Passo Busta" 
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
                {...register('product_type', { required: 'Product Type is required' })}
                className={errors.product_type ? 'error' : ''}
              >
                <option value="">Seleziona tipo prodotto</option>
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
                {...register('quantity', { required: 'Quantity is required', min: { value: 0, message: 'Quantity must be at least 0' } })}
                placeholder="Quantità" 
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
                {...register('quantity_per_box', { min: { value: 0, message: 'Quantity per Box must be at least 0' } })}
                placeholder="Q.tà per Scatola" 
                min="0" 
                step="1"
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantity_completed">Qty Completed</label>
              <input 
                type="number" 
                id="quantity_completed" 
                {...register('quantity_completed', { min: { value: 0, message: 'Quantity Completed must be at least 0' } })}
                placeholder="Q.tà Completata" 
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
          <h3 className="section-title">Dati Commerciali</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="internal_customer_code">FLEXI Lot</label>
              <input 
                type="text" 
                id="internal_customer_code" 
                {...register('internal_customer_code')}
                placeholder="Lotto FLEXI" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="external_customer_code">Customer Lot</label>
              <input 
                type="text" 
                id="external_customer_code" 
                {...register('external_customer_code')}
                placeholder="Lotto Cliente" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="customer_order_ref">Customer Ref</label>
              <input 
                type="text" 
                id="customer_order_ref" 
                {...register('customer_order_ref')}
                placeholder="Riferimento Cliente" 
              />
            </div>
          </div>
        </div>

        {/* DATI LAVORAZIONE & PIANIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">Dati Lavorazione & Pianificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input 
                type="text" 
                id="department" 
                {...register('department')}
                placeholder="Reparto" 
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
                  onFocus={() => setIsDropdownVisible(true)} 
                  onBlur={handleBlur}
                  placeholder="Cerca Fase Produzione" 
                  className={errors.fase ? 'error' : ''}
                />
                <input 
                  type="hidden" 
                  {...register('fase', { required: 'Production Phase is required' })}
                />
                {getFieldError('fase')}
                {isDropdownVisible && filteredPhases.length > 0 && (
                  <div className="dropdown-options">
                    {filteredPhases.map(phase => (
                      <div 
                        key={phase.id} 
                        className="dropdown-option" 
                        onMouseDown={() => handlePhaseSelectWrapper(phase)}
                      >
                        <span className="phase-name">{phase.name}</span>
                        <span className="phase-description">{phase.contenuto_fase || 'Nessuna descrizione'}</span>
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
                {...register('delivery_date', { required: 'Delivery Date is required' })}
                className={errors.delivery_date ? 'error' : ''}
              />
              {getFieldError('delivery_date')}
            </div>
          </div>
        </div>

        {/* Selected Phase Parameters */}
        {selectedPhase && (
          <div className="form-section">
            <h3 className="section-title">Parametri Fase Selezionata</h3>
            <div className="form-grid form-grid--3-cols">
              {selectedPhase.department === DEPARTMENT_TYPES.PRINTING ? (
                <>
                  <div className="form-group">
                    <label htmlFor="v_stampa">Print Speed:</label>
                    <input 
                      type="number" 
                      id="v_stampa"
                      value={getPhaseParamValue('v_stampa')} 
                      onChange={(e) => handlePhaseParamChange('v_stampa', e.target.value)}
                      placeholder="Velocità Stampa"
                      min="0"
                    />
                    <span className="unit-label">mt/h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="t_setup_stampa">Print Setup:</label>
                    <input 
                      type="number" 
                      id="t_setup_stampa"
                      value={getPhaseParamValue('t_setup_stampa')} 
                      onChange={(e) => handlePhaseParamChange('t_setup_stampa', e.target.value)}
                      placeholder="Tempo Setup"
                      min="0"
                      step="0.1"
                    />
                    <span className="unit-label">h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="costo_h_stampa">Costo Stampa:</label>
                    <input 
                      type="number" 
                      id="costo_h_stampa"
                      value={getPhaseParamValue('costo_h_stampa')} 
                      onChange={(e) => handlePhaseParamChange('costo_h_stampa', e.target.value)}
                      placeholder="Costo Orario"
                      min="0"
                      step="0.01"
                    />
                    <span className="unit-label">€/h</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="v_conf">Velocità Confezionamento:</label>
                    <input 
                      type="number" 
                      id="v_conf"
                      value={getPhaseParamValue('v_conf')} 
                      onChange={(e) => handlePhaseParamChange('v_conf', e.target.value)}
                      placeholder="Velocità Confezionamento"
                      min="0"
                    />
                    <span className="unit-label">pz/h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="t_setup_conf">Setup Confezionamento:</label>
                    <input 
                      type="number" 
                      id="t_setup_conf"
                      value={getPhaseParamValue('t_setup_conf')} 
                      onChange={(e) => handlePhaseParamChange('t_setup_conf', e.target.value)}
                      placeholder="Tempo Setup"
                      min="0"
                      step="0.1"
                    />
                    <span className="unit-label">h</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="costo_h_conf">Costo Confezionamento:</label>
                    <input 
                      type="number" 
                      id="costo_h_conf"
                      value={getPhaseParamValue('costo_h_conf')} 
                      onChange={(e) => handlePhaseParamChange('costo_h_conf', e.target.value)}
                      placeholder="Costo Orario"
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
        {calculationResults && calculationResults.totals && (
          <div className="form-section">
            <h3 className="section-title">Risultati Calcolo Produzione</h3>
            <div className="form-grid form-grid--2-cols">
              <div className="form-group">
                <label>Durata Totale (ore):</label>
                <div className="result-value">
                  {typeof calculationResults.totals.duration === 'number' 
                    ? calculationResults.totals.duration.toFixed(2) 
                    : 'Errore calcolo'}
                </div>
              </div>
              <div className="form-group">
                <label>Costo Totale (€):</label>
                <div className="result-value">
                  {typeof calculationResults.totals.cost === 'number' 
                    ? calculationResults.totals.cost.toFixed(2) 
                    : 'Errore calcolo'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="nav-btn today" onClick={handleCalculate} disabled={!selectedPhase}>
            Calcola
          </button>
          <button type="submit" className="nav-btn today" disabled={!calculationResults || isSubmitting}>
            {isSubmitting 
              ? (isEditMode ? 'Aggiornamento Ordine...' : 'Aggiunta al Backlog...') 
              : (isEditMode ? 'Aggiorna Ordine' : 'Aggiungi al Backlog')
            }
          </button>
        </div>
      </form>
    </div>
  );
}

export default BacklogForm;