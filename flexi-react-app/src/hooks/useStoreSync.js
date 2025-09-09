import { useEffect } from 'react';
import { useMachines, useOrders, usePhases } from './useQueries';
import { useMachineStore } from '../store/useMachineStore';
import { useOrderStore } from '../store/useOrderStore';
import { usePhaseStore } from '../store/usePhaseStore';

/**
 * Hook to sync React Query data with Zustand stores
 * This ensures that the stores are populated with data from React Query
 * and components can still use the store selectors for consistency
 */
export const useStoreSync = () => {
  const { data: machines, isLoading: machinesLoading, error: machinesError } = useMachines();
  const { data: orders, isLoading: ordersLoading, error: ordersError } = useOrders();
  const { data: phases, isLoading: phasesLoading, error: phasesError } = usePhases();

  const { setMachines } = useMachineStore();
  const { setOdpOrders } = useOrderStore();
  const { setPhases } = usePhaseStore();

  // Sync machines data
  useEffect(() => {
    if (machines && !machinesLoading && !machinesError) {
      setMachines(machines);
    }
  }, [machines, machinesLoading, machinesError, setMachines]);

  // Sync orders data
  useEffect(() => {
    if (orders && !ordersLoading && !ordersError) {
      setOdpOrders(orders);
    }
  }, [orders, ordersLoading, ordersError, setOdpOrders]);

  // Sync phases data
  useEffect(() => {
    if (phases && !phasesLoading && !phasesError) {
      setPhases(phases);
    }
  }, [phases, phasesLoading, phasesError, setPhases]);

  return {
    isLoading: machinesLoading || ordersLoading || phasesLoading,
    errors: {
      machines: machinesError,
      orders: ordersError,
      phases: phasesError,
    },
  };
};
