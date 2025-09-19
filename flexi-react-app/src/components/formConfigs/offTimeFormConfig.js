import { DEFAULT_VALUES, VALIDATION_MESSAGES } from '../../constants';

/**
 * Off-Time Form Configuration
 * Defines the structure and behavior of the off-time form using the generic form component
 */

export const offTimeFormConfig = {
  validationSchema: 'OFF_TIME',
  
  // Button and context text
  addButtonText: 'Imposta Non Disponibilità',
  editButtonText: 'Aggiorna Non Disponibilità',
  addLoadingText: 'Impostazione...',
  editLoadingText: 'Aggiornamento...',
  addContext: 'Set Machine Unavailability',
  editContext: 'Update Machine Unavailability',
  addErrorMessage: 'Impostazione indisponibilità macchina fallita',
  editErrorMessage: 'Aggiornamento indisponibilità macchina fallita',

  sections: [
    {
      title: 'Periodo di Non Disponibilità',
      fields: [
        {
          name: 'startDate',
          label: 'Data Inizio',
          type: 'date',
          required: true,
          defaultValue: '' // Will be set dynamically
        },
        {
          name: 'startTime',
          label: 'Ora Inizio',
          type: 'time',
          required: true,
          defaultValue: DEFAULT_VALUES.OFF_TIME.START_TIME
        },
        {
          name: 'endDate',
          label: 'Data Fine',
          type: 'date',
          required: true,
          defaultValue: '' // Will be set dynamically
        },
        {
          name: 'endTime',
          label: 'Ora Fine',
          type: 'time',
          required: true,
          defaultValue: DEFAULT_VALUES.OFF_TIME.END_TIME
        }
      ]
    }
  ],

  // Custom validation for off-time form
  customValidation: (data) => {
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
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};
