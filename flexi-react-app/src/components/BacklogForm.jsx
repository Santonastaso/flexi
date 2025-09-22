import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useUIStore, useSchedulerStore, useOrderStore } from '../store';
import { useProductionCalculations, useValidation, useAddOrder, useUpdateOrder } from '../hooks';
import { usePhaseSearch } from '../hooks/usePhaseSearch';
import { showValidationError, showSuccess, showWarning, showError } from '../utils';
import { DEPARTMENT_TYPES, WORK_CENTERS, DEFAULT_VALUES } from '../constants';
import { useErrorHandler } from '../hooks';
import { backlogFormConfig } from './formConfigs';
import GenericForm from './GenericForm';
import {
  Button,
  Input,
  Label,
} from './ui';
import { useQueryClient } from '@tanstack/react-query';

const BacklogForm = ({ onSuccess, orderToEdit }) => {
  const { selectedWorkCenter, showConflictDialog } = useUIStore();
  const { scheduleTaskFromSlot, unscheduleTask } = useSchedulerStore();
  const { calculateProductionMetrics, validatePhaseParameters, autoDetermineWorkCenter, autoDetermineDepartment } = useProductionCalculations();
  const { handleAsync } = useErrorHandler('BacklogForm');
  const { validateOrder } = useValidation();
  
  // React Query mutations
  const addOrderMutation = useAddOrder();
  const updateOrderMutation = useUpdateOrder();
  const queryClient = useQueryClient();
  
  const [calculationResults, setCalculationResults] = useState(null);
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
    delivery_date: orderToEdit?.delivery_date ? new Date(orderToEdit.delivery_date).toISOString().slice(0, 16) : '', 
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
  }, [setPhaseSearch, setSelectedPhase, setEditablePhaseParams]);

  // Handle article code changes to auto-determine department and work center
  const handleArticleCodeChange = useCallback((articleCode, setValue) => {
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
  }, [autoDetermineDepartment, autoDetermineWorkCenter, selectedWorkCenter, setPhaseSearch, setSelectedPhase, setEditablePhaseParams]);

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
          'product_type': 'Tipo Prodotto',
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

    await handleAsync(async () => {
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
      
      let updatedOrder;
      if (isEditMode) {
        // 1. Store new duration and compute time_remaining
        const newDuration = calculationResults?.totals?.duration || orderToEdit.duration;
        const progress = (orderToEdit.quantity_completed / orderToEdit.quantity) || 0;
        const newTimeRemaining = newDuration * (1 - progress);
        
        // 2. If already scheduled, handle duration changes intelligently
        if (orderToEdit.scheduled_machine_id && orderToEdit.scheduled_start_time) {
          console.log('🔄 EDIT FLOW: Starting rescheduling for task', orderToEdit.id);
          console.log('📊 EDIT FLOW: Original duration:', orderToEdit.duration, 'New duration:', newDuration);
          
          const originalDuration = orderToEdit.duration;
          const durationDifference = newDuration - originalDuration;
          
          if (Math.abs(durationDifference) < 0.01) {
            // SCENARIO X: Duration stays the same - do nothing, no scheduling
            console.log('📊 SCENARIO X: Duration unchanged, skipping rescheduling');
            
            // Just update the order data without any scheduling changes
            const orderData = { 
              ...cleanedData, 
              duration: newDuration, 
              cost: calculationResults?.totals?.cost || null
            };
            updatedOrder = await updateOrderMutation.mutateAsync({ id: orderToEdit.id, updates: orderData });
          } else if (durationDifference > 0) {
            // SCENARIO Y: Duration increase - keep the code exactly as it is
            console.log('📈 SCENARIO Y: Duration increased, using standard rescheduling');
            
            const startDate = new Date(orderToEdit.scheduled_start_time);
            const hour = startDate.getUTCHours();
            const minute = startDate.getUTCMinutes();
            const currentDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
            
            console.log('📅 EDIT FLOW: Start date:', startDate.toISOString());
            console.log('⏰ EDIT FLOW: Hour:', hour, 'Minute:', minute);
            console.log('📆 EDIT FLOW: Current date:', currentDate.toISOString());
            
            // First update the task with new duration so scheduleTaskFromSlot can use it
            const tempUpdateData = { duration: newDuration };
            console.log('💾 EDIT FLOW: Updating task with new duration:', tempUpdateData);
            await updateOrderMutation.mutateAsync({ id: orderToEdit.id, updates: tempUpdateData });
            
            // Wait a moment for the store to be updated
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify the task was updated in the store
            const { getOrderById } = useOrderStore.getState();
            const updatedTaskBeforeScheduling = getOrderById(orderToEdit.id);
            console.log('🔍 EDIT FLOW: Task duration after update:', updatedTaskBeforeScheduling?.duration);
            
            // Unschedule the task first (like removing it from the Gantt)
            console.log('🔄 EDIT FLOW: Unscheduling task first');
            await unscheduleTask(orderToEdit.id, queryClient);
            
            // Wait a moment for unscheduling to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 3. Now reschedule it with the new time remaining (like dropping it fresh)
            const machine = { id: orderToEdit.scheduled_machine_id };
            console.log('🎯 EDIT FLOW: Calling scheduleTaskFromSlot with:', {
              taskId: orderToEdit.id,
              machine: machine,
              currentDate: currentDate.toISOString(),
              hour,
              minute,
              timeRemaining: newTimeRemaining
            });
            
            const result = await scheduleTaskFromSlot(orderToEdit.id, machine, currentDate, hour, minute, newTimeRemaining, queryClient);
            console.log('📋 EDIT FLOW: scheduleTaskFromSlot result:', result);
            
            if (result?.conflict) {
              console.log('⚠️ EDIT FLOW: Conflict detected, showing dialog');
              // Add scheduling parameters to the conflict details so the dialog can retry
              const conflictWithParams = {
                ...result,
                schedulingParams: {
                  taskId: orderToEdit.id,
                  machine: machine,
                  currentDate: currentDate,
                  hour: hour,
                  minute: minute,
                  newDuration: newTimeRemaining,
                  originalConflict: result
                }
              };
              showConflictDialog(conflictWithParams);
              return; // Don't continue if there's a conflict
            } else if (result?.error) {
              console.log('❌ EDIT FLOW: Error:', result.error);
              showError(result.error);
              return; // Don't continue if there's an error
            } else {
              console.log('✅ EDIT FLOW: Scheduling successful');
            }
            
            // 4. Use the updated task data from the scheduling result
            const updatedTask = result?.updatedTask;
            console.log('📋 EDIT FLOW: Updated task from scheduling result:', updatedTask);
            
            // Update database with form fields + new scheduling info from the updated task
            const orderData = { 
              ...cleanedData, 
              duration: newDuration, 
              cost: calculationResults?.totals?.cost || null,
              scheduled_start_time: updatedTask?.scheduled_start_time || startDate.toISOString(),
              scheduled_end_time: updatedTask?.scheduled_end_time || new Date(startDate.getTime() + newDuration * 3600000).toISOString(),
              description: updatedTask?.description || orderToEdit.description
            };
            
            console.log('💾 EDIT FLOW: Final order data to save:', orderData);
            updatedOrder = await updateOrderMutation.mutateAsync({ id: orderToEdit.id, updates: orderData });
            console.log('✅ EDIT FLOW: Final update completed:', updatedOrder);
          } else {
            // SCENARIO Z: Duration decrease - new function with adjacent task detection
            console.log('📉 SCENARIO Z: Duration decreased, using adjacent task rescheduling');
            
            const result = await handleDurationDecreaseRescheduling(
              orderToEdit.id, 
              newDuration, 
              newTimeRemaining, 
              cleanedData, 
              calculationResults?.totals?.cost || null,
              queryClient,
              updateOrderMutation,
              scheduleTaskFromSlot,
              unscheduleTask,
              showConflictDialog,
              showError
            );
            
            if (result?.error) {
              console.log('❌ SCENARIO Z: Error:', result.error);
              showError(result.error);
              return;
            }
            
            updatedOrder = result.updatedOrder;
            console.log('✅ SCENARIO Z: Duration decrease rescheduling completed:', updatedOrder);
          }
        } else {
          // Not scheduled, just update the order data
          const orderData = { ...cleanedData, duration: newDuration, cost: calculationResults?.totals?.cost || null };
          updatedOrder = await updateOrderMutation.mutateAsync({ id: orderToEdit.id, updates: orderData });
        }
      } else {
        // New order
        const orderData = { ...cleanedData, duration: calculationResults?.totals?.duration || null, cost: calculationResults?.totals?.cost || null, status: 'NOT SCHEDULED' };
        updatedOrder = await addOrderMutation.mutateAsync(orderData);
      }

      if (onSuccess) onSuccess();
      resetFormAndPhaseState();
      showSuccess(isEditMode ? 'Ordine aggiornato con successo' : 'Ordine aggiunto con successo');
    }, { context: isEditMode ? 'Aggiorna Ordine' : 'Aggiungi Ordine', fallbackMessage: isEditMode ? 'Aggiornamento ordine fallito' : 'Aggiunta ordine fallita' });
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
      showError(validation.error);
      setCalculationResults(null);
      return;
    }
    
    // For CONFEZIONAMENTO, bagStep is not needed, so we can pass null
    const bagStepForCalculation = selectedPhase.department === DEPARTMENT_TYPES.PRINTING ? bagStep : null;
    const results = calculateProductionMetrics(phaseForCalculation, quantity, bagStepForCalculation);
    if (!results || typeof results.totals?.duration !== 'number' || typeof results.totals?.cost !== 'number') {
      showError("Errore nel calcolo. Verifica i parametri della fase.");
      setCalculationResults(null);
      return;
    }
    setCalculationResults(results);
  };

  const getPhaseParamValue = (paramName) => editablePhaseParams[paramName] ?? selectedPhase[paramName] ?? '';

  // SCENARIO Z: Handle duration decrease with adjacent task detection and rescheduling
  const handleDurationDecreaseRescheduling = async (taskId, newDuration, newTimeRemaining, cleanedData, cost, queryClient, updateOrderMutation, scheduleTaskFromSlot, unscheduleTask, showConflictDialog, showError) => {
    try {
      console.log('📉 SCENARIO Z: Starting duration decrease rescheduling for task', taskId);
      
      const { getOrderById, getOdpOrders } = useOrderStore.getState();
      
      // Get current task data
      const currentTask = getOrderById(taskId);
      if (!currentTask) {
        return { error: 'Task not found' };
      }
      
      const startDate = new Date(currentTask.scheduled_start_time);
      const hour = startDate.getUTCHours();
      const minute = startDate.getUTCMinutes();
      const currentDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
      const machine = { id: currentTask.scheduled_machine_id };
      
      console.log('📅 SCENARIO Z: Current task start:', startDate.toISOString());
      console.log('📅 SCENARIO Z: New time remaining:', newTimeRemaining);
      
      // STEP 1: Find ENTIRE CHAIN of adjacent tasks BEFORE any rescheduling
      // Use the ACTUAL scheduled end time from the database (handles split tasks correctly)
      const currentEndTime = new Date(currentTask.scheduled_end_time);
      console.log('📅 SCENARIO Z: Current end time for task A (from DB):', currentEndTime.toISOString());
      
      // Find the complete chain of adjacent tasks BEFORE any rescheduling
      const allTasks = getOdpOrders();
      const adjacentTasksChain = [];
      let currentEndTimeForChain = currentEndTime;
      
      console.log('🔍 SCENARIO Z: Starting to find chain of adjacent tasks...');
      
      // Find continuous chain of adjacent tasks starting from task A's current end time
      while (true) {
        const nextAdjacentTask = allTasks.find(task => {
          if (task.id === taskId || !task.scheduled_machine_id || !task.scheduled_start_time || task.status !== 'SCHEDULED') {
            return false;
          }
          
          // Check if task is on the same machine
          if (task.scheduled_machine_id !== currentTask.scheduled_machine_id) {
            return false;
          }
          
          // Check if this task is already in our chain
          if (adjacentTasksChain.some(chainTask => chainTask.id === task.id)) {
            return false;
          }
          
          const taskStartTime = new Date(task.scheduled_start_time);
          const timeDifferenceMinutes = Math.abs(taskStartTime.getTime() - currentEndTimeForChain.getTime()) / (1000 * 60);
          
          console.log('🔍 SCENARIO Z: Checking task', task.odp_number, 'start:', taskStartTime.toISOString(), 'diff:', timeDifferenceMinutes, 'minutes', 'against end time:', currentEndTimeForChain.toISOString());
          
          return timeDifferenceMinutes <= 120; // Within 2 hours (to catch longer gaps)
        });
        
        if (nextAdjacentTask) {
          console.log('🔗 SCENARIO Z: Found adjacent task in chain:', nextAdjacentTask.odp_number);
          adjacentTasksChain.push(nextAdjacentTask);
          
          // Update the end time for the next iteration (use actual scheduled end time)
          currentEndTimeForChain = new Date(nextAdjacentTask.scheduled_end_time);
          
          console.log('📅 SCENARIO Z: Next task end time for chain:', currentEndTimeForChain.toISOString());
          console.log('🔄 SCENARIO Z: Continuing to search for more adjacent tasks...');
        } else {
          console.log('🛑 SCENARIO Z: No more adjacent tasks found, stopping chain search');
          break; // No more adjacent tasks found
        }
      }
      
      if (adjacentTasksChain.length > 0) {
        console.log('🔗 SCENARIO Z: Found chain of', adjacentTasksChain.length, 'adjacent tasks:', adjacentTasksChain.map(t => t.odp_number));
        
        // STEP 2: Reschedule task A using scenario Y code
        console.log('🔄 SCENARIO Z: Step 2 - Rescheduling task A');
        
        // First update the task with new duration
        const tempUpdateData = { duration: newDuration };
        await updateOrderMutation.mutateAsync({ id: taskId, updates: tempUpdateData });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Unschedule task A
        await unscheduleTask(taskId, queryClient);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Reschedule task A with new time remaining
        const resultA = await scheduleTaskFromSlot(taskId, machine, currentDate, hour, minute, newTimeRemaining, queryClient);
        
        if (resultA?.conflict) {
          console.log('⚠️ SCENARIO Z: Conflict detected for task A, showing dialog');
          const conflictWithParams = {
            ...resultA,
            schedulingParams: {
              taskId: taskId,
              machine: machine,
              currentDate: currentDate,
              hour: hour,
              minute: minute,
              newDuration: newTimeRemaining,
              originalConflict: resultA
            }
          };
          showConflictDialog(conflictWithParams);
          return { error: 'Conflict detected for task A' };
        } else if (resultA?.error) {
          console.log('❌ SCENARIO Z: Error rescheduling task A:', resultA.error);
          return { error: resultA.error };
        }
        
        console.log('✅ SCENARIO Z: Task A rescheduled successfully');
        
        // STEP 3: Reschedule all tasks in the chain sequentially
        console.log('🔄 SCENARIO Z: Step 3 - Rescheduling chain of', adjacentTasksChain.length, 'tasks');
        
        // Use the scheduling result from task A to get its new end time
        let currentEndTimeForRescheduling = new Date(resultA.schedulingResult.endTime);
        const reschedulingResults = [];
        
        // Reschedule each task in the chain sequentially
        for (let i = 0; i < adjacentTasksChain.length; i++) {
          const chainTask = adjacentTasksChain[i];
          console.log(`🔄 SCENARIO Z: Rescheduling chain task ${i + 1}/${adjacentTasksChain.length}:`, chainTask.odp_number);
          
          // Calculate new start time for this chain task (at end of previous task)
          const newStartHour = currentEndTimeForRescheduling.getUTCHours();
          const newStartMinute = currentEndTimeForRescheduling.getUTCMinutes();
          const newStartDate = new Date(Date.UTC(currentEndTimeForRescheduling.getUTCFullYear(), currentEndTimeForRescheduling.getUTCMonth(), currentEndTimeForRescheduling.getUTCDate()));
          
          console.log('📅 SCENARIO Z: Chain task new start time:', currentEndTimeForRescheduling.toISOString());
          console.log('⏰ SCENARIO Z: Chain task new hour:', newStartHour, 'minute:', newStartMinute);
          
          // Get chain task's time remaining
          const chainTaskTimeRemaining = chainTask.time_remaining || chainTask.duration || 1;
          console.log('📊 SCENARIO Z: Chain task time remaining:', chainTaskTimeRemaining);
          
          // Unschedule chain task
          await unscheduleTask(chainTask.id, queryClient);
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Reschedule chain task using scenario Y code
          const resultChainTask = await scheduleTaskFromSlot(chainTask.id, machine, newStartDate, newStartHour, newStartMinute, chainTaskTimeRemaining, queryClient);
          
          if (resultChainTask?.conflict) {
            console.log('⚠️ SCENARIO Z: Conflict detected for chain task', chainTask.odp_number, ', showing dialog');
            const conflictWithParams = {
              ...resultChainTask,
              schedulingParams: {
                taskId: chainTask.id,
                machine: machine,
                currentDate: newStartDate,
                hour: newStartHour,
                minute: newStartMinute,
                newDuration: chainTaskTimeRemaining,
                originalConflict: resultChainTask
              }
            };
            showConflictDialog(conflictWithParams);
            return { error: `Conflict detected for chain task ${chainTask.odp_number}` };
          } else if (resultChainTask?.error) {
            console.log('❌ SCENARIO Z: Error rescheduling chain task', chainTask.odp_number, ':', resultChainTask.error);
            return { error: `Error rescheduling chain task ${chainTask.odp_number}: ${resultChainTask.error}` };
          }
          
          console.log('✅ SCENARIO Z: Chain task', chainTask.odp_number, 'rescheduled successfully');
          reschedulingResults.push(resultChainTask);
          
          // Update the end time for the next iteration (this task's new end time)
          currentEndTimeForRescheduling = new Date(resultChainTask.schedulingResult.endTime);
          console.log('📅 SCENARIO Z: Updated end time for next chain task:', currentEndTimeForRescheduling.toISOString());
        }
        
        console.log('✅ SCENARIO Z: All', adjacentTasksChain.length, 'chain tasks rescheduled successfully');
        
        // Update database with form fields + new scheduling info
        const finalUpdatedTaskA = resultA?.updatedTask;
        const orderData = { 
          ...cleanedData, 
          duration: newDuration, 
          cost: cost,
          scheduled_start_time: finalUpdatedTaskA?.scheduled_start_time || startDate.toISOString(),
          scheduled_end_time: finalUpdatedTaskA?.scheduled_end_time || new Date(startDate.getTime() + newDuration * 3600000).toISOString(),
          description: finalUpdatedTaskA?.description || currentTask.description
        };
        
        const updatedOrder = await updateOrderMutation.mutateAsync({ id: taskId, updates: orderData });
        console.log('✅ SCENARIO Z: Task A and', adjacentTasksChain.length, 'chain tasks rescheduled successfully');
        
        return { updatedOrder };
      } else {
        console.log('📊 SCENARIO Z: No adjacent task found, using standard rescheduling');
        
        // No adjacent task found, use standard rescheduling (scenario Y code)
        const tempUpdateData = { duration: newDuration };
        await updateOrderMutation.mutateAsync({ id: taskId, updates: tempUpdateData });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await unscheduleTask(taskId, queryClient);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await scheduleTaskFromSlot(taskId, machine, currentDate, hour, minute, newTimeRemaining, queryClient);
        
        if (result?.conflict) {
          console.log('⚠️ SCENARIO Z: Conflict detected, showing dialog');
          const conflictWithParams = {
            ...result,
            schedulingParams: {
              taskId: taskId,
              machine: machine,
              currentDate: currentDate,
              hour: hour,
              minute: minute,
              newDuration: newTimeRemaining,
              originalConflict: result
            }
          };
          showConflictDialog(conflictWithParams);
          return { error: 'Conflict detected' };
        } else if (result?.error) {
          console.log('❌ SCENARIO Z: Error:', result.error);
          return { error: result.error };
        }
        
        const updatedTask = result?.updatedTask;
        const orderData = { 
          ...cleanedData, 
          duration: newDuration, 
          cost: cost,
          scheduled_start_time: updatedTask?.scheduled_start_time || startDate.toISOString(),
          scheduled_end_time: updatedTask?.scheduled_end_time || new Date(startDate.getTime() + newDuration * 3600000).toISOString(),
          description: updatedTask?.description || currentTask.description
        };
        
        const updatedOrder = await updateOrderMutation.mutateAsync({ id: taskId, updates: orderData });
        return { updatedOrder };
      }
    } catch (error) {
      console.error('❌ SCENARIO Z: Error in handleDurationDecreaseRescheduling:', error);
      return { error: error.message || 'Error during duration decrease rescheduling' };
    }
  };

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

    // Phase search field
    phase_search: (field, { watch, setValue, getValues, register }) => {
      const currentDepartment = watch('department');
      const currentWorkCenter = watch('work_center');
      const currentQuantity = watch('quantity');
      const currentBagStep = watch('bag_step');
      
      // Update local state when form values change
      useEffect(() => {
        if (currentDepartment !== department) {
          setDepartment(currentDepartment);
        }
        if (currentWorkCenter !== workCenter) {
          setWorkCenter(currentWorkCenter);
        }
        if (currentQuantity !== quantity) {
          setQuantity(currentQuantity);
        }
        if (currentBagStep !== bagStep) {
          setBagStep(currentBagStep);
        }
      }, [currentDepartment, currentWorkCenter, currentQuantity, currentBagStep, department, workCenter, quantity, bagStep]);

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
                  <div className="text-[10px] font-medium">{phase.name}</div>
                  <div className="text-[10px] text-gray-600">{phase.contenuto_fase}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },

    // Phase parameters section
    phase_parameters: () => {
      if (!selectedPhase) return null;
      
      return (
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-gray-900 border-b pb-2">
            Parametri Fase Selezionata
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">{field.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    },

    // Calculation results section
    calculation_results: () => {
      if (!calculationResults?.totals) return null;
      
      return (
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-gray-900 border-b pb-2">
            Risultati Calcolo Produzione
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Durata Totale (ore):</Label>
              <div className="text-[10px] font-semibold text-navy-800">
                {calculationResults.totals.duration.toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Costo Totale (€):</Label>
              <div className="text-[10px] font-semibold text-green-600">
                {calculationResults.totals.cost.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }), [phaseSearch, setPhaseSearch, isDropdownVisible, setIsDropdownVisible, filteredPhases, handleBlur, handlePhaseSelect, selectedPhase, getPhaseParamValue, handlePhaseParamChange, getPhaseFields, calculationResults, handleArticleCodeChange]);

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
      customActions={customActions}
      customFieldRenderers={customFieldRenderers}
    />
  );
};

export default BacklogForm;