import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  DEFAULT_VALUES,
  SEAL_SIDES,
  PRODUCT_TYPES
} from '../../constants';

/**
 * Backlog Form Configuration
 * Defines the structure and behavior of the backlog form using the generic form component
 * Maintains all complex functionality like phase search, calculations, etc.
 */

export const backlogFormConfig = {
  validationSchema: 'ORDER',
  
  // Button and context text
  addButtonText: 'Aggiungi al Backlog',
  editButtonText: 'Aggiorna Ordine',
  addLoadingText: 'Aggiunta...',
  editLoadingText: 'Aggiornamento...',
  addContext: 'Add Order',
  editContext: 'Update Order',
  addErrorMessage: 'Aggiunta ordine fallita',
  editErrorMessage: 'Aggiornamento ordine fallito',

  sections: [
    {
      title: 'Identificazione',
      fields: [
        {
          name: 'odp_number',
          label: 'Numero ODP',
          type: 'text',
          required: true,
          placeholder: 'Inserisci numero ODP'
        },
        {
          name: 'article_code',
          label: 'Codice Articolo',
          type: 'article_code',
          required: true,
          placeholder: 'Inserisci codice articolo'
        },
        {
          name: 'production_lot',
          label: 'Codice Articolo Esterno',
          type: 'text',
          required: true,
          placeholder: 'Inserisci codice articolo esterno'
        },
        {
          name: 'work_center',
          label: 'Centro di Lavoro',
          type: 'select',
          required: true,
          placeholder: 'Seleziona centro di lavoro',
          options: [
            { value: WORK_CENTERS.ZANICA, label: WORK_CENTERS.ZANICA },
            { value: WORK_CENTERS.BUSTO_GAROLFO, label: WORK_CENTERS.BUSTO_GAROLFO }
          ],
          conditional: (fieldValue, watch, getValues) => {
            // This will be handled dynamically in the component
            return true;
          }
        },
        {
          name: 'nome_cliente',
          label: 'Nome Cliente',
          type: 'text',
          required: true,
          placeholder: 'Inserisci nome cliente'
        }
      ]
    },
    {
      title: 'Specifiche Tecniche',
      fields: [
        {
          name: 'bag_height',
          label: 'Altezza Busta (mm)',
          type: 'number',
          required: false,
          placeholder: 'Inserisci altezza busta'
        },
        {
          name: 'bag_width',
          label: 'Larghezza Busta (mm)',
          type: 'number',
          required: false,
          placeholder: 'Inserisci larghezza busta'
        },
        {
          name: 'bag_step',
          label: 'Passo Busta (mm)',
          type: 'number',
          required: false,
          placeholder: 'Inserisci passo busta'
        },
        {
          name: 'seal_sides',
          label: 'Lati Sigillatura',
          type: 'select',
          required: false,
          placeholder: 'Seleziona...',
          options: [
            { value: '3', label: '3' },
            { value: '4', label: '4' }
          ],
          defaultValue: DEFAULT_VALUES.ORDER.SEAL_SIDES
        },
        {
          name: 'product_type',
          label: 'Tipo Prodotto',
          type: 'select',
          required: false,
          placeholder: 'Seleziona...',
          options: [
            { value: PRODUCT_TYPES.CREMA, label: PRODUCT_TYPES.CREMA },
            { value: PRODUCT_TYPES.LIQUIDO, label: PRODUCT_TYPES.LIQUIDO },
            { value: PRODUCT_TYPES.POLVERI, label: PRODUCT_TYPES.POLVERI }
          ]
        },
        {
          name: 'quantity',
          label: 'Quantità',
          type: 'number',
          required: true,
          placeholder: 'Inserisci quantità'
        },
        {
          name: 'quantity_completed',
          label: 'Q.tà Completata',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.ORDER.QUANTITY_COMPLETED
        }
      ]
    },
    {
      title: 'Dati Commerciali',
      fields: [
        {
          name: 'internal_customer_code',
          label: 'Lotto FLEXI',
          type: 'text',
          required: true,
          placeholder: 'Inserisci lotto FLEXI'
        },
        {
          name: 'external_customer_code',
          label: 'Lotto Cliente',
          type: 'text',
          required: true,
          placeholder: 'Inserisci lotto cliente'
        },
        {
          name: 'customer_order_ref',
          label: 'Riferimento Cliente',
          type: 'text',
          required: true,
          placeholder: 'Inserisci riferimento cliente'
        },
        {
          name: 'user_notes',
          label: 'Note Libere',
          type: 'textarea',
          required: false,
          placeholder: 'Inserisci note libere per l\'ordine...',
          rows: 3
        },
        {
          name: 'asd_notes',
          label: 'Note ASD',
          type: 'textarea',
          required: false,
          placeholder: 'Inserisci note ASD per l\'ordine...',
          rows: 3
        }
      ],
      gridCols: 'grid-cols-2 md:grid-cols-3'
    },
    {
      title: 'Dati Lavorazione & Pianificazione',
      fields: [
        {
          name: 'department',
          label: 'Reparto',
          type: 'text',
          required: true,
          readOnly: true,
          className: 'bg-gray-50'
        },
        {
          name: 'phase_search',
          label: 'Cerca Fase di Produzione',
          type: 'phase_search',
          required: true
        },
        {
          name: 'delivery_date',
          label: 'Data di Consegna',
          type: 'datetime-local',
          required: true
        }
      ]
    },
    {
      title: 'Disponibilità Materiali',
      fields: [
        {
          name: 'material_availability_global',
          label: 'Disponibilità Materiale Globale (%)',
          type: 'number',
          required: false,
          placeholder: 'Inserisci percentuale disponibilità (0-100)',
          min: 0,
          max: 100
        }
      ]
    }
  ],

  // Custom field types and behaviors
  customFields: {
    phase_parameters: {
      type: 'phase_parameters',
      label: 'Parametri Fase Selezionata'
    },
    calculation_results: {
      type: 'calculation_results',
      label: 'Risultati Calcolo Produzione'
    }
  },

  // Custom validation for the backlog form
  customValidation: (data) => {
    const errors = {};
    
    // Note: fase and bag_step are optional in the database
    // These validations are only for calculation purposes
    // The form can be submitted without these fields
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};
