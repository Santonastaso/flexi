import {
  DEPARTMENT_TYPES,
  WORK_CENTERS,
  MACHINE_STATUSES,
  SHIFT_TYPES,
  DEFAULT_VALUES
} from '../../constants';

/**
 * Machine Form Configuration
 * Defines the structure and behavior of the machine form using the generic form component
 */

export const machineFormConfig = {
  validationSchema: 'MACHINE',
  
  // Button and context text
  addButtonText: 'Aggiungi Macchina',
  editButtonText: 'Aggiorna Macchina',
  addLoadingText: 'Aggiunta...',
  editLoadingText: 'Aggiornamento...',
  addContext: 'Add Machine',
  editContext: 'Update Machine',
  addErrorMessage: 'Aggiunta macchina fallita',
  editErrorMessage: 'Aggiornamento macchina fallita',

  sections: [
    {
      title: 'Identificazione',
      fields: [
        {
          name: 'department',
          label: 'Department',
          type: 'select',
          required: true,
          options: [
            { value: DEPARTMENT_TYPES.PRINTING, label: DEPARTMENT_TYPES.PRINTING },
            { value: DEPARTMENT_TYPES.PACKAGING, label: DEPARTMENT_TYPES.PACKAGING }
          ],
          defaultValue: DEFAULT_VALUES.MACHINE.DEPARTMENT
        },
        {
          name: 'machine_type',
          label: 'Machine Type',
          type: 'select',
          required: true,
          placeholder: 'Seleziona tipo macchina',
          options: [], // Will be populated dynamically based on department
          conditional: (department) => department === DEPARTMENT_TYPES.PRINTING || department === DEPARTMENT_TYPES.PACKAGING
        },
        {
          name: 'machine_name',
          label: 'Machine Name',
          type: 'text',
          required: true,
          placeholder: 'Nome descrittivo'
        },
        {
          name: 'work_center',
          label: 'Work Center',
          type: 'select',
          required: true,
          placeholder: 'Seleziona un centro di lavoro',
          options: [
            { value: WORK_CENTERS.ZANICA, label: WORK_CENTERS.ZANICA },
            { value: WORK_CENTERS.BUSTO_GAROLFO, label: WORK_CENTERS.BUSTO_GAROLFO }
          ],
          defaultValue: DEFAULT_VALUES.MACHINE.WORK_CENTER,
          helpText: 'Il centro di lavoro è pre-impostato.'
        }
      ]
    },
    {
      title: 'Capacità Tecniche',
      fields: [
        {
          name: 'min_web_width',
          label: 'Min Web Width (mm)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.MIN_WEB_WIDTH
        },
        {
          name: 'max_web_width',
          label: 'Max Web Width (mm)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.MAX_WEB_WIDTH
        },
        {
          name: 'min_bag_height',
          label: 'Min Bag Height (mm)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.MIN_BAG_HEIGHT
        },
        {
          name: 'max_bag_height',
          label: 'Max Bag Height (mm)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.MAX_BAG_HEIGHT
        }
      ]
    },
    {
      title: 'Performance',
      fields: [
        {
          name: 'standard_speed',
          label: 'Standard Speed',
          type: 'number',
          required: true,
          placeholder: 'pz/h o mt/h'
        },
        {
          name: 'setup_time_standard',
          label: 'Setup Time Standard (h)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.SETUP_TIME_STANDARD
        },
        {
          name: 'changeover_color',
          label: 'Changeover Color (h)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.CHANGEOVER_COLOR,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PRINTING
        },
        {
          name: 'changeover_material',
          label: 'Material Changeover (h)',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.CHANGEOVER_MATERIAL,
          conditional: (fieldValue, watch, getValues) => getValues('department') === DEPARTMENT_TYPES.PACKAGING
        }
      ]
    },
    {
      title: 'Disponibilità',
      fields: [
        {
          name: 'active_shifts',
          label: 'Active Shifts',
          type: 'checkbox',
          required: false,
          defaultValue: DEFAULT_VALUES.MACHINE.ACTIVE_SHIFTS,
          options: [
            { value: SHIFT_TYPES.T1, label: SHIFT_TYPES.T1 },
            { value: SHIFT_TYPES.T2, label: SHIFT_TYPES.T2 },
            { value: SHIFT_TYPES.T3, label: SHIFT_TYPES.T3 }
          ]
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          defaultValue: DEFAULT_VALUES.MACHINE.STATUS,
          options: [
            { value: MACHINE_STATUSES.ACTIVE, label: MACHINE_STATUSES.ACTIVE },
            { value: MACHINE_STATUSES.INACTIVE, label: MACHINE_STATUSES.INACTIVE }
          ]
        }
      ]
    }
  ]
};
