import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useOrderStore, useUIStore, useSchedulerStore } from '../store';
import { useProductionCalculations } from '../hooks/useProductionCalculations';
import { usePhaseSearch } from '../hooks/usePhaseSearch';
import { DEPARTMENT_TYPES, WORK_CENTERS, DEFAULT_VALUES, SEAL_SIDES, PRODUCT_TYPES } from '../constants';
import { useErrorHandler } from '../hooks';

// --- Reusable Helper Functions for Validation ---

const validateRequiredStrings = (data, fields) => {
  const errors = [];
  fields.forEach(({ field, name }) => {
    if (!data[field]?.trim()) errors.push(`${name} è obbligatorio`);
  });
  return errors;
};

const validateNumericFields = (data, fields) => {
  const errors = [];
  fields.forEach(({ field, name }) => {
    const value = data[field];
    if (value === '' || value === null || value === undefined) {
      errors.push(`${name} è obbligatorio`);
    } else if (parseFloat(value) < 0) {
      errors.push(`${name} non può essere negativo`);
    }
  });
  return errors;
};

const validateLogicalConditions = (data, conditions) => {
  const errors = [];
  conditions.forEach(({ fieldA, fieldB, message }) => {
    if (data[fieldA] && data[fieldB] && parseFloat(data[fieldA]) > parseFloat(data[fieldB])) {
      errors.push(message);
    }
  });
  return errors;
};

const validateEnumValues = (data, enums) => {
  const errors = [];
  enums.forEach(({ field, name, validValues }) => {
    if (data[field] && !validValues.includes(data[field])) {
      errors.push(`Valore non valido per ${name}`);
    }
  });
  return errors;
};

// --- Constants for Validation Configuration ---

const REQUIRED_STRINGS = [
  { field: 'odp_number', name: 'Numero ODP' },
  { field: 'article_code', name: 'Codice Articolo' },
  { field: 'production_lot', name: 'Codice Articolo Esterno' },
  { field: 'work_center', name: 'Centro di Lavoro' },
  { field: 'department', name: 'Reparto' },
  { field: 'fase', name: 'Fase' },
  { field: 'product_type', name: 'Tipo Prodotto' },
  { field: 'delivery_date', name: 'Data di Consegna' },
  { field: 'nome_cliente', name: 'Nome Cliente' },
  { field: 'internal_customer_code', name: 'Lotto FLEXI' },
  { field: 'external_customer_code', name: 'Lotto Cliente' },
  { field: 'customer_order_ref', name: 'Riferimento Cliente' },
];

const REQUIRED_NUMERICS = [
  { field: 'bag_height', name: 'Altezza Busta' },
  { field: 'bag_width', name: 'Larghezza Busta' },
  { field: 'bag_step', name: 'Passo Busta' },
  { field: 'quantity', name: 'Quantità' },
  { field: 'quantity_per_box', name: 'Quantità per Scatola' },
  { field: 'quantity_completed', name: 'Quantità Completata' },
];

const LOGICAL_CONDITIONS = [
    { fieldA: 'bag_step', fieldB: 'bag_width', message: 'Il Passo Busta non può essere maggiore della Larghezza Busta' },
    { fieldA: 'quantity_completed', fieldB: 'quantity', message: 'La Quantità Completata non può superare la Quantità totale' },
];

const ENUM_VALIDATIONS = [
    { field: 'product_type', name: 'Tipo Prodotto', validValues: Object.values(PRODUCT_TYPES) },
    { field: 'seal_sides', name: 'Lati Sigillatura', validValues: Object.values(SEAL_SIDES) },
    { field: 'department', name: 'Reparto', validValues: Object.values(DEPARTMENT_TYPES) },
    { field: 'work_center', name: 'Centro di Lavoro', validValues: [WORK_CENTERS.ZANICA, WORK_CENTERS.BUSTO_GAROLFO] },
];

const BacklogForm = ({ onSuccess, orderToEdit }) => {
  const { addOdpOrder, updateOdpOrder } = useOrderStore();
  const { showAlert, selectedWorkCenter, showConflictDialog } = useUIStore();
  const { scheduleTask } = useSchedulerStore();
  const { calculateProductionMetrics, validatePhaseParameters, autoDetermineWorkCenter, autoDetermineDepartment } = useProductionCalculations();
  const { handleAsync } = useErrorHandler('BacklogForm');
  
  const [calculationResults, setCalculationResults] = useState(null);
  const isEditMode = Boolean(orderToEdit);
  
  const initialFormData = useMemo(() => ({
    odp_number: orderToEdit?.odp_number || '', 
    article_code: orderToEdit?.article_code || '', 
    production_lot: orderToEdit?.production_lot || '', 
    work_center: orderToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? '' : selectedWorkCenter),
    nome_cliente: orderToEdit?.nome_cliente || '', 
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
    user_notes: orderToEdit?.user_notes || '',
    department: orderToEdit?.department || '', 
    fase: orderToEdit?.fase || '',
  }), [selectedWorkCenter, orderToEdit]);

  const { register, handleSubmit, formState: { isSubmitting }, watch, setValue, getValues, reset, clearErrors } = useForm({ defaultValues: initialFormData });

  const articleCode = watch('article_code');
  const department = watch('department');
  const workCenter = watch('work_center');

  const { phaseSearch, setPhaseSearch, isDropdownVisible, setIsDropdownVisible, selectedPhase, setSelectedPhase, filteredPhases, editablePhaseParams, setEditablePhaseParams, handlePhaseParamChange, handlePhaseSelect, handleBlur } = usePhaseSearch(department, workCenter);

  const resetFormAndPhaseState = useCallback(() => {
    reset(initialFormData);
    setPhaseSearch('');
    setSelectedPhase(null);
    setEditablePhaseParams({});
    setCalculationResults(null);
  }, [initialFormData, reset, setPhaseSearch, setSelectedPhase, setEditablePhaseParams]);

  useEffect(() => {
    if (articleCode) {
      const dept = autoDetermineDepartment(articleCode);
      setValue('department', dept);
      if (selectedWorkCenter === WORK_CENTERS.BOTH) {
        setValue('work_center', autoDetermineWorkCenter(articleCode));
      }
      setValue('fase', '');
      setPhaseSearch('');
      setSelectedPhase(null);
      setEditablePhaseParams({});
      setCalculationResults(null);
    }
  }, [articleCode, autoDetermineDepartment, autoDetermineWorkCenter, setValue, selectedWorkCenter, setPhaseSearch, setSelectedPhase, setEditablePhaseParams]);

  const onSubmit = async (data) => {
    const validationErrors = [
      ...validateRequiredStrings(data, REQUIRED_STRINGS),
      ...validateNumericFields(data, REQUIRED_NUMERICS),
      ...validateLogicalConditions(data, LOGICAL_CONDITIONS),
      ...validateEnumValues(data, ENUM_VALIDATIONS),
    ];

    if (validationErrors.length > 0) {
      showAlert(`Errori di validazione:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    if (!calculationResults?.totals || typeof calculationResults.totals.duration !== 'number' || typeof calculationResults.totals.cost !== 'number') {
      showAlert("Calcola le metriche di produzione valide prima di procedere.", 'warning');
      return;
    }

    await handleAsync(async () => {
      const orderData = { ...data, duration: calculationResults.totals.duration, cost: calculationResults.totals.cost, status: isEditMode ? orderToEdit.status : 'NOT SCHEDULED' };
      const updatedOrder = isEditMode ? await updateOdpOrder(orderToEdit.id, orderData) : await addOdpOrder(orderData);

      if (isEditMode && updatedOrder?.scheduled_machine_id && updatedOrder?.scheduled_start_time) {
        const startDate = new Date(updatedOrder.scheduled_start_time);
        const durationHours = updatedOrder.time_remaining || updatedOrder.duration;
        const endDate = new Date(startDate.getTime() + durationHours * 3600000);
        const result = await scheduleTask(updatedOrder.id, { machine: updatedOrder.scheduled_machine_id, start_time: startDate.toISOString(), end_time: endDate.toISOString() });
        if (result?.conflict) showConflictDialog(result);
        else if (result?.error) showAlert(result.error, 'error');
      }

      if (onSuccess) onSuccess();
      resetFormAndPhaseState();
    }, { context: isEditMode ? 'Aggiorna Ordine' : 'Aggiungi Ordine', fallbackMessage: isEditMode ? 'Aggiornamento ordine fallito' : 'Aggiunta ordine fallita' });
  };

  const handleCalculate = () => {
    if (!selectedPhase || !getValues('quantity') || !getValues('bag_step')) {
      showAlert("Seleziona una fase e inserisci Quantità e Passo Busta per calcolare.", 'warning');
      return;
    }
    const phaseForCalculation = { ...selectedPhase, ...editablePhaseParams };
    const validation = validatePhaseParameters(phaseForCalculation);
    if (!validation.isValid) {
      showAlert(validation.error, 'error');
      setCalculationResults(null);
      return;
    }
    const results = calculateProductionMetrics(phaseForCalculation, getValues('quantity'), getValues('bag_step'));
    if (!results || typeof results.totals?.duration !== 'number' || typeof results.totals?.cost !== 'number') {
      showAlert("Errore nel calcolo. Verifica i parametri della fase.", 'error');
      setCalculationResults(null);
      return;
    }
    setCalculationResults(results);
  };

  const getPhaseParamValue = (paramName) => editablePhaseParams[paramName] ?? selectedPhase[paramName] ?? '';

  const getPhaseFields = () => {
    if (!selectedPhase) return [];
    return selectedPhase.department === DEPARTMENT_TYPES.PRINTING
      ? [
          { name: 'v_stampa', label: 'Velocità Stampa:', unit: 'mt/h' },
          { name: 't_setup_stampa', label: 'Setup Stampa:', unit: 'h' },
          { name: 'costo_h_stampa', label: 'Costo Stampa:', unit: '€/h' },
        ]
      : [
          { name: 'v_conf', label: 'Velocità Confezionamento:', unit: 'pz/h' },
          { name: 't_setup_conf', label: 'Setup Confezionamento:', unit: 'h' },
          { name: 'costo_h_conf', label: 'Costo Confezionamento:', unit: '€/h' },
        ];
  };

  return (
    <div className="content-section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">Identificazione</h3>
          <div className="form-grid form-grid--3-cols">
             {/* ODP, Article Code, Lot... */}
            <div className="form-group"><label htmlFor="odp_number">Numero ODP *</label><input type="text" id="odp_number" {...register('odp_number')} /></div>
            <div className="form-group"><label htmlFor="article_code">Codice Articolo *</label><input type="text" id="article_code" {...register('article_code')} /></div>
            <div className="form-group"><label htmlFor="production_lot">Codice Articolo Esterno *</label><input type="text" id="production_lot" {...register('production_lot')} /></div>
            <div className="form-group"><label htmlFor="work_center">Centro di Lavoro *</label> {selectedWorkCenter === WORK_CENTERS.BOTH ? (<select {...register('work_center')} id="work_center"><option value="">Seleziona</option><option value={WORK_CENTERS.ZANICA}>ZANICA</option><option value={WORK_CENTERS.BUSTO_GAROLFO}>BUSTO GAROLFO</option></select>) : (<><input type="text" id="work_center" value={selectedWorkCenter} disabled className="disabled-input" /><small>Centro di lavoro pre-impostato.</small></>)}</div>
            <div className="form-group"><label htmlFor="nome_cliente">Nome Cliente *</label><input type="text" id="nome_cliente" {...register('nome_cliente')} /></div>
          </div>
        </div>

        {/* SPECIFICHE TECNICHE Section */}
        <div className="form-section">
          <h3 className="section-title">Specifiche Tecniche</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group"><label htmlFor="bag_height">Altezza Busta (mm) *</label><input type="number" id="bag_height" {...register('bag_height')} /></div>
            <div className="form-group"><label htmlFor="bag_width">Larghezza Busta (mm) *</label><input type="number" id="bag_width" {...register('bag_width')} /></div>
            <div className="form-group"><label htmlFor="bag_step">Passo Busta (mm) *</label><input type="number" id="bag_step" {...register('bag_step')} /></div>
            <div className="form-group"><label htmlFor="seal_sides">Lati Sigillatura *</label><select id="seal_sides" {...register('seal_sides')}><option value={SEAL_SIDES.THREE}>3 lati</option><option value={SEAL_SIDES.FOUR}>4 lati</option></select></div>
            <div className="form-group"><label htmlFor="product_type">Tipo Prodotto *</label><select id="product_type" {...register('product_type')}><option value="">Seleziona</option><option value={PRODUCT_TYPES.CREMA}>CREMA</option><option value={PRODUCT_TYPES.LIQUIDO}>LIQUIDO</option><option value={PRODUCT_TYPES.POLVERI}>POLVERI</option></select></div>
            <div className="form-group"><label htmlFor="quantity">Quantità *</label><input type="number" id="quantity" {...register('quantity')} /></div>
            <div className="form-group"><label htmlFor="quantity_per_box">Q.tà per Scatola *</label><input type="number" id="quantity_per_box" {...register('quantity_per_box')} /></div>
            <div className="form-group"><label htmlFor="quantity_completed">Q.tà Completata *</label><input type="number" id="quantity_completed" {...register('quantity_completed')} /></div>
          </div>
        </div>
        
        {/* DATI COMMERCIALI Section */}
        <div className="form-section">
            <h3 className="section-title">Dati Commerciali</h3>
            <div className="form-grid form-grid--3-cols">
                <div className="form-group"><label htmlFor="internal_customer_code">Lotto FLEXI *</label><input type="text" id="internal_customer_code" {...register('internal_customer_code')} /></div>
                <div className="form-group"><label htmlFor="external_customer_code">Lotto Cliente *</label><input type="text" id="external_customer_code" {...register('external_customer_code')} /></div>
                <div className="form-group"><label htmlFor="customer_order_ref">Riferimento Cliente *</label><input type="text" id="customer_order_ref" {...register('customer_order_ref')} /></div>
            </div>
            <div className="form-grid form-grid--1-col">
                <div className="form-group"><label htmlFor="user_notes">Note Libere</label><textarea id="user_notes" {...register('user_notes')} rows="3" placeholder="Inserisci note libere per l'ordine..." /></div>
            </div>
        </div>

        {/* DATI LAVORAZIONE & PIANIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">Dati Lavorazione & Pianificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group"><label htmlFor="department">Reparto *</label><input type="text" id="department" {...register('department')} readOnly className="disabled-input" /></div>
            <div className="form-group"><label htmlFor="phase_search">Cerca Fase di Produzione *</label><div className="searchable-dropdown"><input type="text" id="phase_search" value={phaseSearch} onChange={(e) => setPhaseSearch(e.target.value)} onFocus={() => setIsDropdownVisible(true)} onBlur={handleBlur} /><input type="hidden" {...register('fase')} />{isDropdownVisible && filteredPhases.length > 0 && (<div className="dropdown-options">{filteredPhases.map(phase => (<div key={phase.id} className="dropdown-option" onMouseDown={() => { handlePhaseSelect(phase, setValue, clearErrors); setCalculationResults(null);}}><span className="phase-name">{phase.name}</span><span className="phase-description">{phase.contenuto_fase}</span></div>))}</div>)}</div></div>
            <div className="form-group"><label htmlFor="delivery_date">Data di Consegna *</label><input type="datetime-local" id="delivery_date" {...register('delivery_date')} /></div>
          </div>
        </div>

        {/* Selected Phase Parameters */}
        {selectedPhase && (
          <div className="form-section">
            <h3 className="section-title">Parametri Fase Selezionata</h3>
            <div className="form-grid form-grid--3-cols">
              {getPhaseFields().map(field => (
                <div className="form-group" key={field.name}>
                  <label htmlFor={field.name}>{field.label}</label>
                  <input type="number" id={field.name} value={getPhaseParamValue(field.name)} onChange={(e) => handlePhaseParamChange(field.name, e.target.value)} />
                  <span className="unit-label">{field.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Production Calculation Results */}
        {calculationResults?.totals && (
          <div className="form-section">
            <h3 className="section-title">Risultati Calcolo Produzione</h3>
            <div className="form-grid form-grid--2-cols">
              <div className="form-group"><label>Durata Totale (ore):</label><div className="result-value">{calculationResults.totals.duration.toFixed(2)}</div></div>
              <div className="form-group"><label>Costo Totale (€):</label><div className="result-value">{calculationResults.totals.cost.toFixed(2)}</div></div>
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="nav-btn" onClick={handleCalculate} disabled={!selectedPhase}>Calcola</button>
          <button type="submit" className="nav-btn today" disabled={!calculationResults || isSubmitting}>{isSubmitting ? (isEditMode ? 'Aggiornamento...' : 'Aggiunta...') : (isEditMode ? 'Aggiorna Ordine' : 'Aggiungi al Backlog')}</button>
        </div>
      </form>
    </div>
  );
}

export default BacklogForm;