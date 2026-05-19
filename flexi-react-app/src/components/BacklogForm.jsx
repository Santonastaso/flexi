import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useUIStore, useSchedulerStore } from '../store';
import { useProductionCalculations, useValidation, useAddOrder, useUpdateOrder, useSiteEfficiency } from '../hooks';
import { usePhaseSearch } from '../hooks/usePhaseSearch';
import { normalizeOdpNumber, showValidationError, showSuccess, showWarning, showInfo } from '../utils';
import { DEPARTMENT_TYPES, WORK_CENTERS, DEFAULT_VALUES, TASK_STATUSES } from '../constants';
import { backlogFormConfig } from './formConfigs';
import { formatInTimeZone } from 'date-fns-tz';
import { ITALY_TIMEZONE } from '../utils/dateFormatting';
import GenericForm from './GenericForm';
import {
  Button,
  Input,
  Label,
} from './ui';
import { useQueryClient } from '@tanstack/react-query';

const PhaseSearchField = ({
  field, watch, setValue, register,
  department, setDepartment, workCenter, setWorkCenter,
  quantity, setQuantity, bagStep, setBagStep,
  phaseSearch, setPhaseSearch, isDropdownVisible, setIsDropdownVisible,
  filteredPhases, handleBlur, handlePhaseSelect, setCalculationResults,
}) => {
  const currentDepartment = watch('department');
  const currentWorkCenter = watch('work_center');
  const currentQuantity = watch('quantity');
  const currentBagStep = watch('bag_step');

  useEffect(() => {
    if (currentDepartment !== department) setDepartment(currentDepartment);
    if (currentWorkCenter !== workCenter) setWorkCenter(currentWorkCenter);
    if (currentQuantity !== quantity) setQuantity(currentQuantity);
    if (currentBagStep !== bagStep) setBagStep(currentBagStep);
  }, [currentDepartment, currentWorkCenter, currentQuantity, currentBagStep, department, workCenter, quantity, bagStep, setDepartment, setWorkCenter, setQuantity, setBagStep]);

  return (
    <div className="relative">
      <Input
        type="text"
        value={phaseSearch}
        onChange={(e) => setPhaseSearch(e.target.value)}
        onFocus={() => setIsDropdownVisible(true)}
        onBlur={handleBlur}
        placeholder="Cerca fase di produzione..."
      />
      <input type="hidden" {...register('fase')} />
      {isDropdownVisible && filteredPhases.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
          {filteredPhases.map(phase => (
            <div
              key={phase.id}
              className="px-3 py-1 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
              onMouseDown={() => {
                handlePhaseSelect(phase, setValue, () => {});
                setCalculationResults(null);
              }}
            >
              <div className="text-xs font-medium">{phase.name}</div>
              <div className="text-xs text-gray-600">{phase.contenuto_fase}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BacklogForm = ({ onSuccess, orderToEdit }) => {
  const { selectedWorkCenter } = useUIStore();
  const { getQueueForMachine, rescheduleQueueFromTask } = useSchedulerStore();
  const { calculateProductionMetrics, validatePhaseParameters, autoDetermineWorkCenter, autoDetermineDepartment } = useProductionCalculations();
  const { validateOrder } = useValidation();
  const { data: siteEfficiencyMap = {} } = useSiteEfficiency();
  
  // React Query mutations
  const addOrderMutation = useAddOrder();
  const updateOrderMutation = useUpdateOrder();
  const queryClient = useQueryClient();
  
  const [calculationResults, setCalculationResults] = useState(null);
  const [additionalHours, setAdditionalHours] = useState(0);
  const [efficiency, setEfficiency] = useState(null);
  const isEditMode = Boolean(orderToEdit);
  
  // Create dynamic config based on selected work center
  const dynamicConfig = useMemo(() => {
    const config = { ...backlogFormConfig };
    
    // Update work center field based on selected work center
    if (selectedWorkCenter !== WORK_CENTERS.BOTH) {
      const workCenterField = config.sections[0].fields.find(f => f.name === 'work_center');
      if (workCenterField) {
        workCenterField.disabled = true;
        workCenterField.defaultValue = selectedWorkCenter;
        workCenterField.helpText = 'Centro di lavoro pre-impostato.';
      }
    }
    
    return config;
  }, [selectedWorkCenter]);

  const initialData = useMemo(() => ({
    // Required fields
    odp_number: orderToEdit?.odp_number || '', 
    article_code: orderToEdit?.article_code || '', 
    work_center: orderToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? '' : selectedWorkCenter),
    nome_cliente: orderToEdit?.nome_cliente || '', 
    delivery_date: orderToEdit?.delivery_date ? formatInTimeZone(new Date(orderToEdit.delivery_date), ITALY_TIMEZONE, "yyyy-MM-dd'T'HH:mm") : '', 
    quantity: orderToEdit?.quantity || '', 
    customer_order_ref: orderToEdit?.customer_order_ref || '', 
    department: orderToEdit?.department || '', 
    quantity_completed: orderToEdit?.quantity_completed || DEFAULT_VALUES.ORDER.QUANTITY_COMPLETED,
    
    // Optional fields (can be null)
    production_lot: orderToEdit?.production_lot || null,
    bag_height: orderToEdit?.bag_height || null,
    bag_width: orderToEdit?.bag_width || null, 
    bag_step: orderToEdit?.bag_step || null, 
    seal_sides: orderToEdit?.seal_sides || null, 
    product_type: orderToEdit?.product_type || null,
    internal_customer_code: orderToEdit?.internal_customer_code || null, 
    external_customer_code: orderToEdit?.external_customer_code || null,
    user_notes: orderToEdit?.user_notes || null,
    asd_notes: orderToEdit?.asd_notes || null,
    material_availability_global: orderToEdit?.material_availability_global || null,
    fase: orderToEdit?.fase || null,
  }), [selectedWorkCenter, orderToEdit]);

  const [department, setDepartment] = useState(initialData.department);
  const [workCenter, setWorkCenter] = useState(initialData.work_center);
  const [quantity, setQuantity] = useState(initialData.quantity);
  const [bagStep, setBagStep] = useState(initialData.bag_step);

  // Initialize efficiency from DB when work center changes
  useEffect(() => {
    if (workCenter && siteEfficiencyMap[workCenter] != null) {
      setEfficiency(siteEfficiencyMap[workCenter]);
    } else if (workCenter) {
      setEfficiency(0.80);
    }
  }, [workCenter, siteEfficiencyMap]);

  const { phaseSearch, setPhaseSearch, isDropdownVisible, setIsDropdownVisible, selectedPhase, setSelectedPhase, filteredPhases, editablePhaseParams, setEditablePhaseParams, handlePhaseParamChange, handlePhaseSelect, handleBlur } = usePhaseSearch(
    department, 
    workCenter,
    isEditMode ? orderToEdit?.fase : null
  );

  const resetFormAndPhaseState = useCallback(() => {
    setPhaseSearch('');
    setSelectedPhase(null);
    setEditablePhaseParams({});
    setCalculationResults(null);
    setAdditionalHours(0);
    setEfficiency(siteEfficiencyMap[workCenter] ?? 0.80);
  }, [setPhaseSearch, setSelectedPhase, setEditablePhaseParams, siteEfficiencyMap, workCenter]);

  // Handle article code changes to auto-determine department and work center
  const handleArticleCodeChange = useCallback((articleCode, setValue) => {
    if (articleCode) {
      const dept = autoDetermineDepartment(articleCode);
      setValue('department', dept);
      setDepartment(dept);
      
      const wc = autoDetermineWorkCenter(articleCode);
      setValue('work_center', wc);
      setWorkCenter(wc);
    }
  }, [autoDetermineDepartment, autoDetermineWorkCenter]);

  const handleSubmit = async (data) => {
    const validation = validateOrder(data);
    
    if (!validation.isValid) {
      // Show validation errors with better formatting
      const errorMessages = Object.entries(validation.errors).map(([field, message]) => {
        // Map field names to user-friendly labels
        const fieldLabels = {
          'odp_number': 'Numero ODP',
          'article_code': 'Codice Articolo',
          'work_center': 'Centro di Lavoro',
          'nome_cliente': 'Nome Cliente',
          'quantity': 'Quantità',
          'delivery_date': 'Data di Consegna',
          'customer_order_ref': 'Riferimento Ordine Cliente',
          'department': 'Reparto',
          'bag_height': 'Altezza Busta',
          'bag_width': 'Larghezza Busta',
          'bag_step': 'Passo Busta',
          'seal_sides': 'Lati Sigillatura',
          'product_type': 'Linea di Produzione',
          'internal_customer_code': 'Codice Cliente Interno',
          'external_customer_code': 'Codice Cliente Esterno'
        };
        
        const fieldLabel = fieldLabels[field] || field;
        return `${fieldLabel}: ${message}`;
      });
      
      showValidationError(errorMessages);
      return;
    }
    
    // Optional: Only require calculation results if phase is provided
    // For STAMPA phases, also require bag_step; for CONFEZIONAMENTO, only fase is needed
    const hasPhase = data.fase;
    const needsBagStep = selectedPhase?.department === DEPARTMENT_TYPES.PRINTING;
    const hasRequiredFields = hasPhase && (!needsBagStep || data.bag_step);
    
    if (hasRequiredFields && (!calculationResults?.totals || typeof calculationResults.totals.duration !== 'number' || typeof calculationResults.totals.cost !== 'number')) {
      showWarning("Calcola le metriche di produzione valide prima di procedere.");
      return;
    }

    try {
      // Filter out UI-only fields that shouldn't be sent to the database
      const { phase_search, ...dbData } = data;
      
      // Clean data: convert empty strings to null for optional fields
      const cleanedData = {
        ...dbData,
        // UUID fields
        fase: dbData.fase === '' ? null : dbData.fase,
        scheduled_machine_id: dbData.scheduled_machine_id === '' ? null : dbData.scheduled_machine_id,
        // Optional string fields
        production_lot: dbData.production_lot === '' ? null : dbData.production_lot,
        internal_customer_code: dbData.internal_customer_code === '' ? null : dbData.internal_customer_code,
        external_customer_code: dbData.external_customer_code === '' ? null : dbData.external_customer_code,
        user_notes: dbData.user_notes === '' ? null : dbData.user_notes,
        asd_notes: dbData.asd_notes === '' ? null : dbData.asd_notes,
        material_availability_global: dbData.material_availability_global === '' ? null : dbData.material_availability_global,
        // Optional numeric fields
        bag_height: dbData.bag_height === '' ? null : dbData.bag_height,
        bag_width: dbData.bag_width === '' ? null : dbData.bag_width,
        bag_step: dbData.bag_step === '' ? null : dbData.bag_step,
        seal_sides: dbData.seal_sides === '' ? null : dbData.seal_sides,
        product_type: dbData.product_type === '' ? null : dbData.product_type
      };

      // cleanedData.odp_number = normalizeOdpNumber(cleanedData.odp_number); // Removed to avoid changing the ODP number which causes duplication issues
      
      if (isEditMode) {
        // Calculate new duration
        const baseDuration = calculationResults?.totals?.duration || orderToEdit.duration;
        const newDuration = baseDuration + (parseFloat(additionalHours) || 0);
        // Update order data only (no scheduling)
        const orderData = {
          ...cleanedData,
          duration: newDuration,
          cost: calculationResults?.totals?.cost || null
        };

        await updateOrderMutation.mutateAsync({ id: orderToEdit.id, updates: orderData });

        // Auto-reschedule downstream tasks if duration changed on a scheduled task
        const isScheduled = orderToEdit.scheduled_machine_id && orderToEdit.scheduled_start_time;
        const durationChanged = Math.abs(newDuration - (orderToEdit.duration ?? 0)) > 0.01;

        if (isScheduled && durationChanged) {
          const allOrders = queryClient.getQueryData(['orders']) || [];
          const queue = getQueueForMachine(orderToEdit.scheduled_machine_id, allOrders);
          const taskIndex = queue.findIndex(t => t.id === orderToEdit.id);
          if (taskIndex >= 0) {
            await rescheduleQueueFromTask(
              orderToEdit.scheduled_machine_id,
              queue.slice(taskIndex),
              new Date(orderToEdit.scheduled_start_time)
            );
          }
          showSuccess('Ordine aggiornato · Coda ricalcolata');
        } else {
          showSuccess('Ordine aggiornato con successo');
        }
      } else {
        // New order - create with NOT SCHEDULED status
        // Note: time_remaining should NOT be set for new orders as it's a generated column
        const baseDuration = calculationResults?.totals?.duration || null;
        const finalDuration = baseDuration ? baseDuration + (parseFloat(additionalHours) || 0) : null;
        const orderData = { 
          ...cleanedData, 
          duration: finalDuration, 
          cost: calculationResults?.totals?.cost || null, 
          status: TASK_STATUSES.NOT_SCHEDULED 
        };
        
        // Remove any fields that shouldn't be in the insert
        delete orderData.time_remaining;
        delete orderData.progress;
        
        await addOrderMutation.mutateAsync(orderData);
        showSuccess('✅ Ordine creato con successo! Vai alla pagina Pianificazione per aggiungerlo alla coda di una macchina.');
      }

      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      if (onSuccess) onSuccess();
      resetFormAndPhaseState();
    } catch (error) {
      console.error('Error saving order:', error);
      const errorMessage = error?.message || error?.error?.message || 'Si è verificato un errore durante il salvataggio dell\'ordine';
      showValidationError([errorMessage]);
    }
  };

  const handleCalculate = () => {
    if (!selectedPhase) {
      showWarning("Seleziona una fase prima di calcolare.");
      return;
    }
    
    // Validate required fields based on department
    if (!quantity) {
      showWarning("Inserisci la quantità per calcolare.");
      return;
    }
    
    if (selectedPhase.department === DEPARTMENT_TYPES.PRINTING && !bagStep) {
      showWarning("Inserisci il passo busta per calcolare la stampa.");
      return;
    }
    
    const phaseForCalculation = { ...selectedPhase, ...editablePhaseParams };
    const validation = validatePhaseParameters(phaseForCalculation);
    
    if (!validation.isValid) {
      showWarning(`Parametri fase non validi: ${validation.error || 'Errore sconosciuto'}`);
      return;
    }
    
    try {
      const effValue = parseFloat(efficiency) || 0.80;
      const results = calculateProductionMetrics(phaseForCalculation, quantity, bagStep, effValue);
      setCalculationResults(results);
      showSuccess("Calcolo completato con successo!");
    } catch (error) {
      showWarning("Errore durante il calcolo delle metriche.");
    }
  };

  const getPhaseFields = useCallback(() => {
    if (!selectedPhase) return [];
    
    // Return different fields based on department
    if (selectedPhase.department === DEPARTMENT_TYPES.PRINTING) {
      return [
        { name: 'v_stampa', label: 'Velocità Stampa', unit: 'm/h' },
        { name: 'costo_h_stampa', label: 'Costo Orario', unit: '€/h' },
        { name: 't_setup_stampa', label: 'Tempo Setup', unit: 'h' },
      ];
    } else if (selectedPhase.department === DEPARTMENT_TYPES.PACKAGING) {
      return [
        { name: 'v_conf', label: 'Velocità Confezionamento', unit: 'pz/h' },
        { name: 'costo_h_conf', label: 'Costo Orario', unit: '€/h' },
        { name: 't_setup_conf', label: 'Tempo Setup', unit: 'h' },
      ];
    }
    
    return [];
  }, [selectedPhase]);

  const getPhaseParamValue = (paramName) => editablePhaseParams[paramName] ?? selectedPhase[paramName] ?? '';

  // Custom field renderers for the backlog form
  const customFieldRenderers = useMemo(() => ({
    // Article code field with auto-determination
    article_code: (field, { watch, setValue, getValues, register }) => {
      return (
        <Input 
          type="text" 
          {...register(field.name, {
            ...field.validation,
            onChange: (e) => {
              // Call the registered onChange first
              if (field.validation?.onChange) {
                field.validation.onChange(e);
              }
              // Then trigger our automation
              handleArticleCodeChange(e.target.value, setValue);
            }
          })}
          placeholder={field.placeholder}
          disabled={field.disabled}
          className={field.className}
        />
      );
    },

    // Phase search field -- delegates to PhaseSearchField component to avoid hooks-in-callback violation
    phase_search: (field, { watch, setValue, getValues, register }) => {
      return (
        <PhaseSearchField
          field={field}
          watch={watch}
          setValue={setValue}
          register={register}
          department={department}
          setDepartment={setDepartment}
          workCenter={workCenter}
          setWorkCenter={setWorkCenter}
          quantity={quantity}
          setQuantity={setQuantity}
          bagStep={bagStep}
          setBagStep={setBagStep}
          phaseSearch={phaseSearch}
          setPhaseSearch={setPhaseSearch}
          isDropdownVisible={isDropdownVisible}
          setIsDropdownVisible={setIsDropdownVisible}
          filteredPhases={filteredPhases}
          handleBlur={handleBlur}
          handlePhaseSelect={handlePhaseSelect}
          setCalculationResults={setCalculationResults}
        />
      );
    },

    // Phase parameters section
    phase_parameters: () => {
      if (!selectedPhase) return null;
      
      return (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">
            Parametri Fase Selezionata
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {getPhaseFields().map(field => (
              <div className="space-y-2" key={field.name}>
                <Label htmlFor={field.name}>{field.label}</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    type="number" 
                    id={field.name} 
                    value={getPhaseParamValue(field.name)} 
                    onChange={(e) => handlePhaseParamChange(field.name, e.target.value)} 
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">{field.unit}</span>
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="efficiency">Fattore Efficienza</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  id="efficiency"
                  step="0.01"
                  min="0.01"
                  max="1"
                  value={efficiency ?? ''}
                  onChange={(e) => {
                    setEfficiency(e.target.value);
                    setCalculationResults(null);
                  }}
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">0-1</span>
              </div>
            </div>
          </div>
        </div>
      );
    },

    // Calculation results section
    calculation_results: () => {
      if (!calculationResults?.totals) return null;
      
      const finalDuration = calculationResults.totals.duration + (parseFloat(additionalHours) || 0);
      
      return (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">
            Risultati Calcolo Produzione
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Durata Calcolata (ore):</Label>
              <div className="text-sm font-semibold text-gray-600">
                {calculationResults.totals.duration.toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ore Aggiuntive:</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={additionalHours}
                onChange={(e) => setAdditionalHours(e.target.value)}
                className="text-sm"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Durata Finale (ore):</Label>
              <div className="text-sm font-semibold text-navy-800">
                {finalDuration.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <div className="space-y-2">
              <Label>Costo Totale (€):</Label>
              <div className="text-sm font-semibold text-green-600">
                {calculationResults.totals.cost.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }), [phaseSearch, setPhaseSearch, isDropdownVisible, setIsDropdownVisible, filteredPhases, handleBlur, handlePhaseSelect, selectedPhase, getPhaseParamValue, handlePhaseParamChange, getPhaseFields, calculationResults, additionalHours, handleArticleCodeChange, department, workCenter, quantity, bagStep, efficiency]);

  // Custom actions (Calculate button)
  const customActions = useMemo(() => (
    <div className="flex justify-end space-x-4 pt-6">
      <Button type="button" variant="outline" onClick={handleCalculate} disabled={!selectedPhase}>
        Calcola
      </Button>
    </div>
  ), [selectedPhase, handleCalculate]);

  // Use mutation loading state
  const isLoading = addOrderMutation.isPending || updateOrderMutation.isPending;

  return (
    <GenericForm
      config={dynamicConfig}
      initialData={initialData}
      onSubmit={handleSubmit}
      onSuccess={onSuccess}
      isEditMode={isEditMode}
      isLoading={isLoading}
      customFieldRenderers={customFieldRenderers}
      customActions={customActions}
    />
  );
};

export default BacklogForm;
