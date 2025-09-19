/**
 * Example of how to use the new React Query + Zustand architecture
 * 
 * This file demonstrates the proper way to fetch and use data after the refactoring.
 * Components should use React Query hooks for data fetching and mutations,
 * while Zustand stores are used for client-side state and selectors.
 */

import React from 'react';
import { useMachines, useAddMachine, useUpdateMachine, useRemoveMachine } from '../hooks/useQueries';
import { useStoreSync } from '../hooks/useStoreSync';
import { useMachineStore } from '../store/useMachineStore';

const DataUsageExample = () => {
  // 1. Sync React Query data with Zustand stores
  // This should be called at the app level (e.g., in App.jsx)
  useStoreSync();

  // 2. Use React Query hooks for data fetching
  const { data: machines, isLoading, error } = useMachines();
  
  // 3. Use React Query mutations for data modifications
  const addMachineMutation = useAddMachine();
  const updateMachineMutation = useUpdateMachine();
  const removeMachineMutation = useRemoveMachine();

  // 4. Use Zustand store for client-side state and selectors
  const { getMachinesByWorkCenter } = useMachineStore();

  const handleAddMachine = async (machineData) => {
    try {
      await addMachineMutation.mutateAsync(machineData);
      // React Query will automatically update the cache and trigger re-renders
    } catch (error) {
      console.error('Failed to add machine:', error);
    }
  };

  const handleUpdateMachine = async (id, updates) => {
    try {
      await updateMachineMutation.mutateAsync({ id, updates });
      // React Query will automatically update the cache and trigger re-renders
    } catch (error) {
      console.error('Failed to update machine:', error);
    }
  };

  const handleRemoveMachine = async (id) => {
    try {
      await removeMachineMutation.mutateAsync(id);
      // React Query will automatically update the cache and trigger re-renders
    } catch (error) {
      console.error('Failed to remove machine:', error);
    }
  };

  // 5. Use Zustand selectors for derived data
  const machinesByWorkCenter = getMachinesByWorkCenter('CUTTING');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Machines ({machines?.length || 0})</h2>
      <ul>
        {machines?.map(machine => (
          <li key={machine.id}>
            {machine.machine_name} - {machine.work_center}
          </li>
        ))}
      </ul>
      
      <h3>Cutting Machines ({machinesByWorkCenter.length})</h3>
      <ul>
        {machinesByWorkCenter.map(machine => (
          <li key={machine.id}>
            {machine.machine_name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DataUsageExample;
