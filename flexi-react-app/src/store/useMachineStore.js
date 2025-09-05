import { createEntityStore } from './storeFactory';
import { apiService } from '../services';
import { generateCalendarForYear } from '../utils/calendarPopulationUtils';
import { showSuccess, showWarning } from '../utils';

// Create machine store using the factory with custom calendar logic
export const useMachineStore = createEntityStore(
  'Machine',
  'machines',
  {
    add: async (newMachine) => {
      const added = await apiService.addMachine(newMachine);
      
      // Automatically populate the new machine's calendar
      try {
        const currentYear = new Date().getFullYear();
        const records = generateCalendarForYear([added], currentYear);
        if (records.length > 0) {
          await apiService.bulkUpsertMachineAvailability(records);
        }
        showSuccess(`Machine "${added?.machine_name || 'Unknown'}" added and calendar set successfully`);
      } catch (calendarError) {
        showWarning(`Machine added, but failed to set calendar: ${calendarError.message}`);
      }
      
      return added;
    },
    update: apiService.updateMachine,
    remove: apiService.removeMachine,
  }
);
