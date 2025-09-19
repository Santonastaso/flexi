import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  DEFAULT_VALUES
} from '../../constants';

/**
 * Phase Form Configuration
 * Defines the structure and behavior of the phase form using the generic form component
 */

export const phaseFormConfig = {
  validationSchema: 'PHASE',
  
  // Button and context text
  addButtonText: 'Aggiungi Fase',
  editButtonText: 'Aggiorna Fase',
  addLoadingText: 'Aggiunta Fase...',
  editLoadingText: 'Aggiornamento Fase...',
  addContext: 'Add Phase',
  editContext: 'Update Phase',
  addErrorMessage: 'Aggiunta fase fallita',
  editErrorMessage: 'Aggiornamento fase fallita',

  sections: [
    {
      title: 'Informazioni Fase',
      fields: [
        {
          name: 'name',
          label: 'Nome Fase',
          type: 'text',
          required: true,
          placeholder: 'es. Stampa Alta Velocità'
        },
        {
          name: 'department',
          label: 'Tipo Fase',
          type: 'select',
          required: true,
          options: [
            { value: DEPARTMENT_TYPES.PRINTING, label: DEPARTMENT_TYPES.PRINTING },
            { value: DEPARTMENT_TYPES.PACKAGING, label: DEPARTMENT_TYPES.PACKAGING }
          ],
          defaultValue: DEFAULT_VALUES.PHASE.DEPARTMENT
        },
        {
          name: 'numero_persone',
          label: 'Numero di Persone Richieste',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.PHASE.NUMERO_PERSONE
        },
        {
          name: 'work_center',
          label: 'Centro di Lavoro',
          type: 'select',
          required: true,
          options: [
            { value: WORK_CENTERS.ZANICA, label: WORK_CENTERS.ZANICA },
            { value: WORK_CENTERS.BUSTO_GAROLFO, label: WORK_CENTERS.BUSTO_GAROLFO }
          ],
          defaultValue: DEFAULT_VALUES.PHASE.WORK_CENTER,
          helpText: 'Il centro di lavoro è impostato in base alla tua selezione di accesso'
        }
      ]
    },
    {
      title: 'Parametri Stampa',
      fields: [
        {
          name: 'v_stampa',
          label: 'Velocità Stampa (mt/h)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.PHASE.V_STAMPA,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PRINTING
        },
        {
          name: 't_setup_stampa',
          label: 'Tempo Setup (ore)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.PHASE.T_SETUP_STAMPA,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PRINTING
        },
        {
          name: 'costo_h_stampa',
          label: 'Costo Orario (€/h)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.PHASE.COSTO_H_STAMPA,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PRINTING
        }
      ]
    },
    {
      title: 'Parametri Confezionamento',
      fields: [
        {
          name: 'v_conf',
          label: 'Velocità Confezionamento (pz/h)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.PHASE.V_CONF,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PACKAGING
        },
        {
          name: 't_setup_conf',
          label: 'Tempo Setup (ore)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.PHASE.T_SETUP_CONF,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PACKAGING
        },
        {
          name: 'costo_h_conf',
          label: 'Costo Orario (€/h)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.PHASE.COSTO_H_CONF,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PACKAGING
        }
      ]
    },
    {
      title: 'Descrizione Fase',
      fields: [
        {
          name: 'contenuto_fase',
          label: 'Descrizione Contenuto Fase',
          type: 'textarea',
          required: true,
          placeholder: 'Descrivi il contenuto della fase e i requisiti...',
          rows: 3
        }
      ],
      gridCols: 'grid-cols-1'
    }
  ]
};
