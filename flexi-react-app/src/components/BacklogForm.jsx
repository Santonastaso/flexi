import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useUIStore, useSchedulerStore } from '../store';
import { useProductionCalculations, useValidation, useAddOrder, useUpdateOrder } from '../hooks';
import { usePhaseSearch } from '../hooks/usePhaseSearch';
import { showValidationError, showSuccess, showWarning } from '../utils';
import { DEPARTMENT_TYPES, WORK_CENTERS, DEFAULT_VALUES, SEAL_SIDES, PRODUCT_TYPES } from '../constants';
import { useErrorHandler } from '../hooks';
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

const BacklogForm = ({ onSuccess, orderToEdit }) => {
  const { selectedWorkCenter, showConflictDialog } = useUIStore();
  const { scheduleTask } = useSchedulerStore();
  const { calculateProductionMetrics, validatePhaseParameters, autoDetermineWorkCenter, autoDetermineDepartment } = useProductionCalculations();
  const { handleAsync } = useErrorHandler('BacklogForm');
  const { validateOrder } = useValidation();
  
  // React Query mutations
  const addOrderMutation = useAddOrder();
  const updateOrderMutation = useUpdateOrder();
  
  const [calculationResults, setCalculationResults] = useState(null);
  const isEditMode = Boolean(orderToEdit);
  
  const initialFormData = useMemo(() => ({
    odp_number: orderToEdit?.odp_number || '', 
    article_code: orderToEdit?.article_code || '', 
    production_lot: orderToEdit?.production_lot || '', 
    work_center: orderToEdit?.work_center || (selectedWorkCenter === WORK_CENTERS.BOTH ? '' : selectedWorkCenter),
    nome_cliente: orderToEdit?.nome_cliente || '', 
    delivery_date: orderToEdit?.delivery_date ? new Date(orderToEdit.delivery_date).toISOString().slice(0, 16) : '', 
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

  // Effect to populate phase data when editing an existing order
  useEffect(() => {
    if (isEditMode && orderToEdit?.fase) {
      // For now, we'll need to fetch the phase data
      // This will be handled by the phase search hook when it's migrated to React Query
      // For now, we'll set the phase ID and let the phase search handle the rest
      setValue('fase', orderToEdit.fase);
    }
  }, [isEditMode, orderToEdit?.fase, setValue]);

  const onSubmit = async (data) => {
    const validation = validateOrder(data);
    
    if (!validation.isValid) {
      showValidationError(Object.values(validation.errors));
      return;
    }
    
    if (!calculationResults?.totals || typeof calculationResults.totals.duration !== 'number' || typeof calculationResults.totals.cost !== 'number') {
      showWarning("Calcola le metriche di produzione valide prima di procedere.");
      return;
    }

    await handleAsync(async () => {
      const orderData = { ...data, duration: calculationResults.totals.duration, cost: calculationResults.totals.cost, status: isEditMode ? orderToEdit.status : 'NOT SCHEDULED' };
      
      let updatedOrder;
      if (isEditMode) {
        updatedOrder = await updateOrderMutation.mutateAsync({ id: orderToEdit.id, updates: orderData });
      } else {
        updatedOrder = await addOrderMutation.mutateAsync(orderData);
      }

      if (isEditMode && updatedOrder?.scheduled_machine_id && updatedOrder?.scheduled_start_time) {
        const startDate = new Date(updatedOrder.scheduled_start_time);
        const durationHours = updatedOrder.time_remaining || updatedOrder.duration;
        const endDate = new Date(startDate.getTime() + durationHours * 3600000);
        const result = await scheduleTask(updatedOrder.id, { machine: updatedOrder.scheduled_machine_id, start_time: startDate.toISOString(), end_time: endDate.toISOString() });
        if (result?.conflict) showConflictDialog(result);
        else if (result?.error) showError(result.error);
      }

      if (onSuccess) onSuccess();
      resetFormAndPhaseState();
      showSuccess(isEditMode ? 'Ordine aggiornato con successo' : 'Ordine aggiunto con successo');
    }, { context: isEditMode ? 'Aggiorna Ordine' : 'Aggiungi Ordine', fallbackMessage: isEditMode ? 'Aggiornamento ordine fallito' : 'Aggiunta ordine fallita' });
  };

  const handleCalculate = () => {
    if (!selectedPhase || !getValues('quantity') || !getValues('bag_step')) {
      showWarning("Seleziona una fase e inserisci Quantità e Passo Busta per calcolare.");
      return;
    }
    const phaseForCalculation = { ...selectedPhase, ...editablePhaseParams };
    const validation = validatePhaseParameters(phaseForCalculation);
    if (!validation.isValid) {
              showError(validation.error);
      setCalculationResults(null);
      return;
    }
    const results = calculateProductionMetrics(phaseForCalculation, getValues('quantity'), getValues('bag_step'));
    if (!results || typeof results.totals?.duration !== 'number' || typeof results.totals?.cost !== 'number') {
      showError("Errore nel calcolo. Verifica i parametri della fase.");
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

  // Use mutation loading state
  const isLoading = addOrderMutation.isPending || updateOrderMutation.isPending;

  return (
    <div className="p-2 bg-white rounded-lg shadow-sm border">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {/* IDENTIFICAZIONE Section */}
        <div className="space-y-3">
                       <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Identificazione</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="odp_number">Numero ODP *</Label>
              <Input type="text" id="odp_number" {...register('odp_number')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="article_code">Codice Articolo *</Label>
              <Input type="text" id="article_code" {...register('article_code')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="production_lot">Codice Articolo Esterno *</Label>
              <Input type="text" id="production_lot" {...register('production_lot')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_center">Centro di Lavoro *</Label>
              {selectedWorkCenter === WORK_CENTERS.BOTH ? (
                <Select onValueChange={(value) => setValue('work_center', value)} defaultValue={watch('work_center')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WORK_CENTERS.ZANICA}>ZANICA</SelectItem>
                    <SelectItem value={WORK_CENTERS.BUSTO_GAROLFO}>BUSTO GAROLFO</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input type="text" id="work_center" value={selectedWorkCenter} disabled className="bg-gray-50" />
                  <p className="text-xs text-gray-500">Centro di lavoro pre-impostato.</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome_cliente">Nome Cliente *</Label>
              <Input type="text" id="nome_cliente" {...register('nome_cliente')} />
            </div>
          </div>
        </div>

        {/* SPECIFICHE TECNICHE Section */}
        <div className="space-y-3">
                       <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Specifiche Tecniche</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bag_height">Altezza Busta (mm) *</Label>
              <Input type="number" id="bag_height" {...register('bag_height')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bag_width">Larghezza Busta (mm) *</Label>
              <Input type="number" id="bag_width" {...register('bag_width')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bag_step">Passo Busta (mm) *</Label>
              <Input type="number" id="bag_step" {...register('bag_step')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seal_sides">Lati Sigillatura *</Label>
              <Select onValueChange={(value) => setValue('seal_sides', value)} defaultValue={watch('seal_sides')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEAL_SIDES.THREE}>3 lati</SelectItem>
                  <SelectItem value={SEAL_SIDES.FOUR}>4 lati</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_type">Tipo Prodotto *</Label>
              <Select onValueChange={(value) => setValue('product_type', value)} defaultValue={watch('product_type')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PRODUCT_TYPES.CREMA}>CREMA</SelectItem>
                  <SelectItem value={PRODUCT_TYPES.LIQUIDO}>LIQUIDO</SelectItem>
                  <SelectItem value={PRODUCT_TYPES.POLVERI}>POLVERI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantità *</Label>
              <Input type="number" id="quantity" {...register('quantity')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_per_box">Q.tà per Scatola *</Label>
              <Input type="number" id="quantity_per_box" {...register('quantity_per_box')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_completed">Q.tà Completata *</Label>
              <Input type="number" id="quantity_completed" {...register('quantity_completed')} />
            </div>
          </div>
        </div>
        
        {/* DATI COMMERCIALI Section */}
        <div className="space-y-3">
                       <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Dati Commerciali</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="internal_customer_code">Lotto FLEXI *</Label>
              <Input type="text" id="internal_customer_code" {...register('internal_customer_code')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external_customer_code">Lotto Cliente *</Label>
              <Input type="text" id="external_customer_code" {...register('external_customer_code')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_order_ref">Riferimento Cliente *</Label>
              <Input type="text" id="customer_order_ref" {...register('customer_order_ref')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_notes">Note Libere</Label>
            <textarea 
              id="user_notes" 
              {...register('user_notes')} 
              rows="3" 
              placeholder="Inserisci note libere per l'ordine..." 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* DATI LAVORAZIONE & PIANIFICAZIONE Section */}
        <div className="space-y-3">
                       <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Dati Lavorazione & Pianificazione</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="department">Reparto *</Label>
              <Input type="text" id="department" {...register('department')} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase_search">Cerca Fase di Produzione *</Label>
              <div className="relative">
                <Input 
                  type="text" 
                  id="phase_search" 
                  value={phaseSearch} 
                  onChange={(e) => setPhaseSearch(e.target.value)} 
                  onFocus={() => setIsDropdownVisible(true)} 
                  onBlur={handleBlur} 
                />
                <input type="hidden" {...register('fase')} />
                {isDropdownVisible && filteredPhases.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                    {filteredPhases.map(phase => (
                      <div 
                        key={phase.id} 
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onMouseDown={() => { 
                          handlePhaseSelect(phase, setValue, clearErrors); 
                          setCalculationResults(null);
                        }}
                      >
                        <div className="font-medium">{phase.name}</div>
                        <div className="text-xs text-gray-600">{phase.contenuto_fase}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_date">Data di Consegna *</Label>
              <Input type="datetime-local" id="delivery_date" {...register('delivery_date')} />
            </div>
          </div>
        </div>

        {/* Selected Phase Parameters */}
                  {selectedPhase && (
            <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Parametri Fase Selezionata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
            </div>
          </div>
        )}

        {/* Production Calculation Results */}
                  {calculationResults?.totals && (
            <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-gray-900 border-b pb-2">Risultati Calcolo Produzione</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Durata Totale (ore):</Label>
                                 <div className="text-xs font-semibold text-blue-600">{calculationResults.totals.duration.toFixed(2)}</div>
              </div>
              <div className="space-y-2">
                <Label>Costo Totale (€):</Label>
                                 <div className="text-xs font-semibold text-green-600">{calculationResults.totals.cost.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4 pt-6">
          <Button type="button" variant="outline" onClick={handleCalculate} disabled={!selectedPhase}>
            Calcola
          </Button>
          <Button type="submit" disabled={!calculationResults || isLoading}>
            {isLoading ? (isEditMode ? 'Aggiornamento...' : 'Aggiunta...') : (isEditMode ? 'Aggiorna Ordine' : 'Aggiungi al Backlog')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default BacklogForm;