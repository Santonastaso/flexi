import { createEntityStore } from './storeFactory';
import { apiService } from '../services';

// Create phase store using the factory
export const usePhaseStore = createEntityStore(
  'Phase',
  'phases',
  {
    add: apiService.addPhase,
    update: apiService.updatePhase,
    remove: apiService.removePhase,
  }
);
