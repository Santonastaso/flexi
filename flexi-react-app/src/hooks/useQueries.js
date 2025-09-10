import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services';
import { showSuccess, showWarning } from '../utils';
import { generateCalendarForYear } from '../utils/calendarPopulationUtils';
import { WORK_CENTERS } from '../constants';

// Query Keys
export const queryKeys = {
  machines: ['machines'],
  machine: (id) => ['machines', id],
  machinesByWorkCenter: (workCenter) => ['machines', 'workCenter', workCenter],
  
  orders: ['orders'],
  order: (id) => ['orders', id],
  
  phases: ['phases'],
  phase: (id) => ['phases', id],
  
  machineAvailability: (machineId, startDate, endDate) => 
    ['machineAvailability', machineId, startDate, endDate],
  machineAvailabilityForDate: (machineId, dateStr) => 
    ['machineAvailability', machineId, 'date', dateStr],
  machineAvailabilityForDateAllMachines: (dateStr) => 
    ['machineAvailability', 'allMachines', dateStr],
};

// ===== MACHINES =====

export const useMachines = () => {
  return useQuery({
    queryKey: queryKeys.machines,
    queryFn: () => apiService.getMachines(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useMachine = (id) => {
  return useQuery({
    queryKey: queryKeys.machine(id),
    queryFn: () => apiService.getMachines().then(machines => 
      machines.find(machine => machine.id === id)
    ),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};

export const useMachinesByWorkCenter = (workCenter) => {
  return useQuery({
    queryKey: queryKeys.machinesByWorkCenter(workCenter),
    queryFn: () => apiService.getMachines().then(machines => {
      if (workCenter === WORK_CENTERS.BOTH) {
        return machines;
      }
      return machines.filter(machine => machine.work_center === workCenter);
    }),
    staleTime: 2 * 60 * 1000,
  });
};

export const useAddMachine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newMachine) => {
      const added = await apiService.addMachine(newMachine);
      
      // Automatically populate the new machine's calendar
      try {
        const currentYear = new Date().getUTCFullYear();
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
    onSuccess: (newMachine) => {
      // Invalidate and refetch machines queries
      queryClient.invalidateQueries({ queryKey: queryKeys.machines });
      queryClient.invalidateQueries({ queryKey: queryKeys.machinesByWorkCenter() });
      
      // Add to cache optimistically
      queryClient.setQueryData(queryKeys.machines, (oldData) => {
        return oldData ? [...oldData, newMachine] : [newMachine];
      });
    },
  });
};

export const useUpdateMachine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }) => apiService.updateMachine(id, updates),
    onSuccess: (updatedMachine, { id }) => {
      // Invalidate and refetch machines queries
      queryClient.invalidateQueries({ queryKey: queryKeys.machines });
      queryClient.invalidateQueries({ queryKey: queryKeys.machinesByWorkCenter() });
      
      // Update cache optimistically
      queryClient.setQueryData(queryKeys.machines, (oldData) => {
        return oldData?.map(machine => 
          machine.id === id ? { ...machine, ...updatedMachine } : machine
        );
      });
      
      queryClient.setQueryData(queryKeys.machine(id), updatedMachine);
      
      showSuccess(`Machine "${updatedMachine?.machine_name || 'Unknown'}" updated successfully`);
    },
  });
};

export const useRemoveMachine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id) => {
      const machine = await apiService.getMachines().then(machines => 
        machines.find(machine => machine.id === id)
      );
      await apiService.removeMachine(id);
      return machine;
    },
    onSuccess: (removedMachine) => {
      // Invalidate and refetch machines queries
      queryClient.invalidateQueries({ queryKey: queryKeys.machines });
      queryClient.invalidateQueries({ queryKey: queryKeys.machinesByWorkCenter() });
      
      // Remove from cache optimistically
      queryClient.setQueryData(queryKeys.machines, (oldData) => {
        return oldData?.filter(machine => machine.id !== removedMachine.id);
      });
      
      queryClient.removeQueries({ queryKey: queryKeys.machine(removedMachine.id) });
      
      showSuccess(`Machine "${removedMachine?.machine_name || 'Unknown'}" deleted successfully`);
    },
  });
};

// ===== ORDERS =====

export const useOrders = () => {
  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: () => apiService.getOdpOrders(),
    staleTime: 1 * 60 * 1000, // 1 minute - orders change frequently
  });
};

export const useOrder = (id) => {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: async () => {
      try {
        // Try to fetch the specific order first
        return await apiService.getOdpOrder(id);
      } catch (error) {
        // If that fails, fall back to fetching all orders and finding the one we need
        // This provides better resilience and can use cached data
        const orders = await apiService.getOdpOrders();
        const order = orders.find(order => order.id === id);
        if (!order) {
          throw new Error(`Order with id ${id} not found`);
        }
        return order;
      }
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });
};

export const useAddOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (orderData) => apiService.addOdpOrder(orderData),
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      
      // Add to cache optimistically
      queryClient.setQueryData(queryKeys.orders, (oldData) => {
        return oldData ? [newOrder, ...oldData] : [newOrder];
      });
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }) => apiService.updateOdpOrder(id, updates),
    onSuccess: (updatedOrder, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      
      // Update cache optimistically
      queryClient.setQueryData(queryKeys.orders, (oldData) => {
        return oldData?.map(order => 
          order.id === id ? { ...order, ...updatedOrder } : order
        );
      });
      
      queryClient.setQueryData(queryKeys.order(id), updatedOrder);
    },
  });
};

export const useRemoveOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => apiService.removeOdpOrder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      
      // Remove from cache optimistically
      queryClient.setQueryData(queryKeys.orders, (oldData) => {
        return oldData?.filter(order => order.id !== id);
      });
      
      queryClient.removeQueries({ queryKey: queryKeys.order(id) });
    },
  });
};

// ===== PHASES =====

export const usePhases = () => {
  return useQuery({
    queryKey: queryKeys.phases,
    queryFn: () => apiService.getPhases(),
    staleTime: 5 * 60 * 1000, // 5 minutes - phases don't change often
  });
};

export const usePhase = (id) => {
  return useQuery({
    queryKey: queryKeys.phase(id),
    queryFn: () => apiService.getPhases().then(phases => 
      phases.find(phase => phase.id === id)
    ),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAddPhase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (phaseData) => apiService.addPhase(phaseData),
    onSuccess: (newPhase) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phases });
      
      // Add to cache optimistically
      queryClient.setQueryData(queryKeys.phases, (oldData) => {
        return oldData ? [...oldData, newPhase] : [newPhase];
      });
    },
  });
};

export const useUpdatePhase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }) => apiService.updatePhase(id, updates),
    onSuccess: (updatedPhase, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phases });
      
      // Update cache optimistically
      queryClient.setQueryData(queryKeys.phases, (oldData) => {
        return oldData?.map(phase => 
          phase.id === id ? { ...phase, ...updatedPhase } : phase
        );
      });
      
      queryClient.setQueryData(queryKeys.phase(id), updatedPhase);
    },
  });
};

export const useRemovePhase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => apiService.removePhase(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phases });
      
      // Remove from cache optimistically
      queryClient.setQueryData(queryKeys.phases, (oldData) => {
        return oldData?.filter(phase => phase.id !== id);
      });
      
      queryClient.removeQueries({ queryKey: queryKeys.phase(id) });
    },
  });
};

// ===== MACHINE AVAILABILITY =====

export const useMachineAvailabilityForDateRange = (machineId, startDate, endDate) => {
  return useQuery({
    queryKey: queryKeys.machineAvailability(machineId, startDate, endDate),
    queryFn: () => apiService.getMachineAvailabilityForDateRange(machineId, startDate, endDate),
    enabled: !!machineId && !!startDate && !!endDate,
    staleTime: 30 * 1000, // 30 seconds - availability changes frequently
  });
};

export const useMachineAvailabilityForDate = (machineId, dateStr) => {
  return useQuery({
    queryKey: queryKeys.machineAvailabilityForDate(machineId, dateStr),
    queryFn: () => apiService.getMachineAvailabilityForDate(machineId, dateStr),
    enabled: !!machineId && !!dateStr,
    staleTime: 30 * 1000,
  });
};

export const useMachineAvailabilityForDateAllMachines = (dateStr) => {
  return useQuery({
    queryKey: queryKeys.machineAvailabilityForDateAllMachines(dateStr),
    queryFn: () => apiService.getMachineAvailabilityForDateAllMachines(dateStr),
    enabled: !!dateStr,
    staleTime: 30 * 1000,
  });
};

export const useSetMachineAvailability = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ machineId, dateStr, unavailableHours }) => 
      apiService.setMachineAvailability(machineId, dateStr, unavailableHours),
    onSuccess: (_, { machineId, dateStr }) => {
      // Invalidate related availability queries
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.machineAvailabilityForDate(machineId, dateStr) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.machineAvailabilityForDateAllMachines(dateStr) 
      });
    },
  });
};

export const useSetUnavailableHoursForRange = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ machineId, startDate, endDate, startTime, endTime }) => 
      apiService.setUnavailableHoursForRange(machineId, startDate, endDate, startTime, endTime),
    onSuccess: (_, { machineId, startDate, endDate }) => {
      // Invalidate availability queries for the date range
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.machineAvailability(machineId, startDate, endDate) 
      });
    },
  });
};

export const useBulkUpsertMachineAvailability = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (records) => apiService.bulkUpsertMachineAvailability(records),
    onSuccess: () => {
      // Invalidate all machine availability queries
      queryClient.invalidateQueries({ queryKey: ['machineAvailability'] });
    },
  });
};
