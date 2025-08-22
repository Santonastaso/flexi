import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStore } from '../store/useStore';
import { toDateString, addDaysToDate } from '../utils/dateUtils';
import { DEFAULT_VALUES, VALIDATION_MESSAGES } from '../constants';

function OffTimeForm({ machineId, currentDate, onSuccess }) {
  const [validationErrors, setValidationErrors] = useState({});
  const setMachineUnavailability = useStore(state => state.setMachineUnavailability);
  const showAlert = useStore(state => state.showAlert);

  const validateForm = (data) => {
    const errors = {};
    
    // Check if end date is before start date
    if (data.startDate && data.endDate) {
      const startDateObj = new Date(data.startDate);
      const endDateObj = new Date(data.endDate);
      
      if (endDateObj < startDateObj) {
        errors.endDate = VALIDATION_MESSAGES.END_DATE_BEFORE_START;
      }
      
      // If dates are the same, check that end time is after start time
      if (data.startDate === data.endDate && data.startTime && data.endTime) {
        if (data.startTime >= data.endTime) {
          errors.endTime = VALIDATION_MESSAGES.END_TIME_BEFORE_START;
        }
      }
    }
    
    return errors;
  };

  const onSubmit = async (data) => {
    // Clear any previous validation errors
    setValidationErrors({});
    clearErrors(['startDate', 'startTime', 'endDate', 'endTime']);
    
    // Validate the form
    const validationErrors = validateForm(data);
    if (Object.keys(validationErrors).length > 0) {
      setValidationErrors(validationErrors);
      
      // Set React Hook Form errors for proper field highlighting
      Object.entries(validationErrors).forEach(([field, message]) => {
        setError(field, { type: 'validation', message });
      });
      
      showAlert('Please fix the validation errors before submitting.', 'warning');
      return;
    }

    try {
      await setMachineUnavailability(machineId, data.startDate, data.endDate, data.startTime, data.endTime);
      showAlert('Machine unavailability set successfully!', 'success');
      
      // Call the success callback to refresh calendar data
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form
      reset();
    } catch (error) {
      showAlert(`Failed to set machine unavailability: ${error.message}`, 'error');
      throw error; // Re-throw to trigger error handling
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
    setError,
    clearErrors
  } = useForm({
    defaultValues: {
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: ''
    }
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const startTime = watch('startTime');
  const endTime = watch('endTime');

  useEffect(() => {
    const today = new Date();
    const tomorrow = addDaysToDate(today, 1);
    
    setValue('startDate', toDateString(today));
    setValue('endDate', toDateString(tomorrow));
    setValue('startTime', DEFAULT_VALUES.OFF_TIME.START_TIME);
    setValue('endTime', DEFAULT_VALUES.OFF_TIME.END_TIME);
  }, [currentDate]);

  // Clear validation errors when dates/times change
  useEffect(() => {
    if (startDate && endDate && startTime && endTime) {
      clearErrors(['startDate', 'startTime', 'endDate', 'endTime']);
      setValidationErrors({});
    }
  }, [startDate, endDate, startTime, endTime]);

  // Helper function to get error message for a field
  const getFieldError = (fieldName) => {
    // Check React Hook Form errors first, then custom validation errors
    const error = errors[fieldName] || validationErrors[fieldName];
    return error ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {error.message || error}
      </span>
    ) : null;
  };

  return (
    <div className="off-time-section">
      <h3>Set Off-Time Period</h3>
      
      <form onSubmit={handleSubmit(onSubmit)} className="off-time-form">
        <div className="form-grid form-grid--4-cols">
          <div className="form-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              {...register('startDate')}
              className={`date-input ${(errors.startDate || validationErrors.startDate) ? 'error' : ''}`}
            />
            {getFieldError('startDate')}
          </div>
          
          <div className="form-group">
            <label htmlFor="startTime">Start Time</label>
            <input
              type="time"
              id="startTime"
              {...register('startTime')}
              className={`time-input ${(errors.startTime || validationErrors.startTime) ? 'error' : ''}`}
            />
            {getFieldError('startTime')}
          </div>
          
          <div className="form-group">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              {...register('endDate')}
              className={`date-input ${(errors.endDate || validationErrors.endDate) ? 'error' : ''}`}
            />
            {getFieldError('endDate')}
          </div>
          
          <div className="form-group">
            <label htmlFor="endTime">End Time</label>
            <input
              type="time"
              id="endTime"
              {...register('endTime')}
              className={`time-input ${(errors.endTime || validationErrors.endTime) ? 'error' : ''}`}
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
            {isSubmitting ? 'Setting...' : 'Set Off-Time'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default OffTimeForm;
