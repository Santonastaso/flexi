import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSchedulerStore, useUIStore } from '../store';
import { format, addDays } from 'date-fns';
import { DEFAULT_VALUES, VALIDATION_MESSAGES } from '../constants';
import { useErrorHandler } from '../hooks';
import {
  Button,
  Input,
  Label,
} from './ui';

function OffTimeForm({ machineId, currentDate, onSuccess }) {
  const { setMachineUnavailability } = useSchedulerStore();
  const { showAlert } = useUIStore();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('OffTimeForm');

  // Custom validation resolver for React Hook Form
  const validateForm = (data) => {
    const errors = {};
    
    // Check if end date is before start date
    if (data.startDate && data.endDate) {
      const startDateObj = new Date(data.startDate);
      const endDateObj = new Date(data.endDate);
      
      if (endDateObj < startDateObj) {
        errors.endDate = {
          type: 'validation',
          message: VALIDATION_MESSAGES.END_DATE_BEFORE_START
        };
      }
      
      // If dates are the same, check that end time is after start time
      if (data.startDate === data.endDate && data.startTime && data.endTime) {
        if (data.startTime >= data.endTime) {
          errors.endTime = {
            type: 'validation',
            message: VALIDATION_MESSAGES.END_TIME_BEFORE_START
          };
        }
      }
    }
    
    return {
      values: data,
      errors: Object.keys(errors).length > 0 ? errors : {}
    };
  };

  const onSubmit = async (data) => {
    await handleAsync(
      async () => {
        await setMachineUnavailability(machineId, data.startDate, data.endDate, data.startTime, data.endTime);
        showAlert('Indisponibilità macchina impostata con successo!', 'success');
        
        // Call the success callback to refresh calendar data
        if (onSuccess) {
          onSuccess();
        }
        
        // Reset form
        reset();
      },
      { 
        context: 'Set Machine Unavailability', 
        fallbackMessage: 'Impostazione indisponibilità macchina fallita'
      }
    );
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    reset
  } = useForm({
    defaultValues: {
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: ''
    },
    resolver: validateForm
  });

  useEffect(() => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
          setValue('startDate', format(today, 'yyyy-MM-dd'));
      setValue('endDate', format(tomorrow, 'yyyy-MM-dd'));
    setValue('startTime', DEFAULT_VALUES.OFF_TIME.START_TIME);
    setValue('endTime', DEFAULT_VALUES.OFF_TIME.END_TIME);
  }, [currentDate, setValue]);

  // Helper function to get error message for a field
  const getFieldError = (fieldName) => {
    const error = errors[fieldName];
    return error ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {error.message}
      </span>
    ) : null;
  };

    return (
    <div className="p-2 bg-white rounded-lg shadow-sm border">
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Imposta Periodo di Non Disponibilità</h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label htmlFor="startDate">Data Inizio</Label>
            <Input
              type="date"
              id="startDate"
              {...register('startDate')}
              className={errors.startDate ? 'border-red-500' : ''}
            />
            {getFieldError('startDate')}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="startTime">Ora Inizio</Label>
            <Input
              type="time"
              id="startTime"
              {...register('startTime')}
              className={errors.startTime ? 'border-red-500' : ''}
            />
            {getFieldError('startTime')}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="endDate">Data Fine</Label>
            <Input
              type="date"
              id="endDate"
              {...register('endDate')}
              className={errors.endDate ? 'border-red-500' : ''}
            />
            {getFieldError('endDate')}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="endTime">Ora Fine</Label>
            <Input
              type="time"
              id="endTime"
              {...register('endTime')}
              className={errors.endTime ? 'border-red-500' : ''}
            />
            {getFieldError('endTime')}
          </div>
        </div>
        
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Impostazione...' : 'Imposta Non Disponibilità'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default OffTimeForm;
