import { useCallback, useMemo, useReducer } from 'react';
import { MACHINE_STATUSES, WORK_CENTERS } from '../constants';

const createEmptyFilters = () => ({
  workCenter: [],
  department: [],
  machineType: [],
  machineName: []
});

const normalizeFilters = (filters = {}) => ({
  workCenter: Array.isArray(filters.workCenter) ? filters.workCenter : [],
  department: Array.isArray(filters.department) ? filters.department : [],
  machineType: Array.isArray(filters.machineType) ? filters.machineType : [],
  machineName: Array.isArray(filters.machineName) ? filters.machineName : []
});

const loadStoredFilters = (storageKey) => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return normalizeFilters(JSON.parse(saved));
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
  return createEmptyFilters();
};

const buildMachineData = (machines, selectedWorkCenter) => {
  if (!machines || machines.length === 0) {
    return { activeMachines: [], workCenters: [], departments: [], machineTypes: [], machineNames: [] };
  }

  let workCenterFiltered = machines;
  if (selectedWorkCenter && selectedWorkCenter !== WORK_CENTERS.BOTH) {
    workCenterFiltered = machines.filter(machine => machine.work_center === selectedWorkCenter);
  }

  const activeMachines = workCenterFiltered.filter(machine => machine.status === MACHINE_STATUSES.ACTIVE);
  if (activeMachines.length === 0) {
    return { activeMachines: [], workCenters: [], departments: [], machineTypes: [], machineNames: [] };
  }

  const workCenterSet = new Set();
  const departmentSet = new Set();
  const machineTypeSet = new Set();
  const machineNameSet = new Set();

  for (const machine of activeMachines) {
    if (machine.work_center) workCenterSet.add(machine.work_center);
    if (machine.department) departmentSet.add(machine.department);
    if (machine.machine_type) machineTypeSet.add(machine.machine_type);
    if (machine.machine_name) machineNameSet.add(machine.machine_name);
  }

  return {
    activeMachines,
    workCenters: Array.from(workCenterSet).sort(),
    departments: Array.from(departmentSet).sort(),
    machineTypes: Array.from(machineTypeSet).sort(),
    machineNames: Array.from(machineNameSet).sort()
  };
};

const applyMachineFilters = (activeMachines, filters) => {
  let filtered = activeMachines;

  if (filters.workCenter.length > 0) {
    filtered = filtered.filter(machine => filters.workCenter.includes(machine.work_center));
  }

  if (filters.department.length > 0) {
    filtered = filtered.filter(machine => filters.department.includes(machine.department));
  }

  if (filters.machineType.length > 0) {
    filtered = filtered.filter(machine => filters.machineType.includes(machine.machine_type));
  }

  if (filters.machineName.length > 0) {
    filtered = filtered.filter(machine => filters.machineName.includes(machine.machine_name));
  }

  return filtered;
};

export const useMachineFilters = ({ machines, selectedWorkCenter, storageKey }) => {
  const filterReducer = useCallback((state, action) => {
    let nextState;
    switch (action.type) {
      case 'SET_FILTER':
        nextState = normalizeFilters({ ...state, [action.payload.filterName]: action.payload.value });
        break;
      case 'CLEAR_FILTERS':
        nextState = createEmptyFilters();
        break;
      default:
        return state;
    }
    localStorage.setItem(storageKey, JSON.stringify(nextState));
    return nextState;
  }, [storageKey]);

  const [filters, dispatch] = useReducer(filterReducer, storageKey, loadStoredFilters);

  const machineData = useMemo(
    () => buildMachineData(machines, selectedWorkCenter),
    [machines, selectedWorkCenter]
  );

  const filteredMachines = useMemo(
    () => applyMachineFilters(machineData.activeMachines, filters),
    [machineData, filters]
  );

  const setFilter = useCallback((filterName, value) => {
    dispatch({ type: 'SET_FILTER', payload: { filterName, value } });
  }, []);

  const clearMachineFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  return {
    filters,
    machineData,
    filteredMachines,
    setFilter,
    clearMachineFilters
  };
};
