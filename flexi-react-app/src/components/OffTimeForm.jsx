import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSchedulerStore, useUIStore } from '../store';
import { format, addDays } from 'date-fns';
import { DEFAULT_VALUES, VALIDATION_MESSAGES } from '../constants';
import { useErrorHandler } from '../hooks';

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
    <div className="off-time-section">
      <h3>Imposta Periodo di Non Disponibilità</h3>
      
      <form onSubmit={handleSubmit(onSubmit)} className="off-time-form">
        <div className="form-grid form-grid--4-cols">
          <div className="form-group">
            <label htmlFor="startDate">Data Inizio</label>
            <input
              type="date"
              id="startDate"
              {...register('startDate')}
              className={`date-input ${errors.startDate ? 'error' : ''}`}
            />
            {getFieldError('startDate')}
          </div>
          
          <div className="form-group">
            <label htmlFor="startTime">Ora Inizio</label>
            <input
              type="time"
              id="startTime"
              {...register('startTime')}
              className={`time-input ${errors.startTime ? 'error' : ''}`}
            />
            {getFieldError('startTime')}
          </div>
          
          <div className="form-group">
            <label htmlFor="endDate">Data Fine</label>
            <input
              type="date"
              id="endDate"
              {...register('endDate')}
              className={`date-input ${errors.endDate ? 'error' : ''}`}
            />
            {getFieldError('endDate')}
          </div>
          
          <div className="form-group">
            <label htmlFor="endTime">Ora Fine</label>
            <input
              type="time"
              id="endTime"
              {...register('endTime')}
              className={`time-input ${errors.endTime ? 'error' : ''}`}
            />
            {getFieldError('endTime')}
          </div>
        </div>
        
        <div className="form-actions">
          <button
            type="submit"
            className="nav-btn today"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Impostazione...' : 'Imposta Non Disponibilità'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default OffTimeForm;
