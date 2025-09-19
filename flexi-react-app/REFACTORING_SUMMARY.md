# Zustand Store Refactoring Summary

## Overview
The Zustand stores have been refactored to remove direct data-fetching logic and rely on React Query as the single source of truth for server state. This separation of concerns provides better data management, caching, and error handling.

## Key Changes

### 1. Store Architecture Changes

#### Before (Direct API Calls)
- Stores directly called `apiService` methods
- Stores managed both client state and server state
- Data fetching logic mixed with state management

#### After (React Query + Zustand)
- **React Query**: Handles all server state (data fetching, caching, mutations)
- **Zustand Stores**: Handle only client-side state and provide selectors
- Clear separation of concerns

### 2. Modified Files

#### Store Files
- `src/store/useMachineStore.js` - Removed add/update/remove methods
- `src/store/useOrderStore.js` - Removed add/update/remove methods  
- `src/store/usePhaseStore.js` - Removed add/update/remove methods
- `src/store/useMainStore.js` - Simplified init method, removed data fetching
- `src/store/storeFactory.js` - Deprecated CRUD actions

#### New Files
- `src/hooks/useStoreSync.js` - Syncs React Query data with Zustand stores
- `src/examples/DataUsageExample.jsx` - Example of proper usage

### 3. Data Flow

#### New Data Flow
1. **React Query** fetches data from API
2. **useStoreSync** hook syncs React Query data to Zustand stores
3. **Components** use React Query hooks for data fetching and mutations
4. **Components** use Zustand selectors for derived data and client state

#### Real-time Updates
- Real-time subscriptions now only handle business logic (e.g., split task updates)
- Data updates are handled by React Query invalidation
- Stores no longer directly update from real-time events

## Usage Guidelines

### For Data Fetching
```javascript
// ✅ Use React Query hooks
import { useMachines, useOrders, usePhases } from '../hooks/useQueries';

const { data: machines, isLoading, error } = useMachines();
```

### For Data Mutations
```javascript
// ✅ Use React Query mutations
import { useAddMachine, useUpdateMachine, useRemoveMachine } from '../hooks/useQueries';

const addMachineMutation = useAddMachine();
await addMachineMutation.mutateAsync(machineData);
```

### For Client State and Selectors
```javascript
// ✅ Use Zustand stores for selectors and client state
import { useMachineStore } from '../store/useMachineStore';

const { getMachinesByWorkCenter } = useMachineStore();
const cuttingMachines = getMachinesByWorkCenter('CUTTING');
```

### For Store Synchronization
```javascript
// ✅ Use useStoreSync at app level
import { useStoreSync } from '../hooks/useStoreSync';

// In App.jsx or main component
useStoreSync(); // This syncs React Query data with Zustand stores
```

## Migration Guide

### Components Using Store Methods
Replace direct store method calls with React Query mutations:

```javascript
// ❌ Old way
const { addMachine } = useMachineStore();
await addMachine(machineData);

// ✅ New way
const addMachineMutation = useAddMachine();
await addMachineMutation.mutateAsync(machineData);
```

### Components Using Store Data
Continue using store selectors, but ensure `useStoreSync()` is called:

```javascript
// ✅ This still works
const { getMachines } = useMachineStore();
const machines = getMachines();

// But make sure to call useStoreSync() at app level
```

### Real-time Updates
Real-time handlers now only handle business logic, not data updates:

```javascript
// ❌ Old way - directly updating store
setMachines([...getMachines(), newMachine]);

// ✅ New way - let React Query handle data updates
console.log('Machine added:', newMachine);
// React Query will handle the data update through invalidation
```

## Benefits

1. **Better Caching**: React Query provides intelligent caching and background updates
2. **Error Handling**: Centralized error handling for data operations
3. **Loading States**: Built-in loading and error states
4. **Optimistic Updates**: Automatic optimistic updates for better UX
5. **Separation of Concerns**: Clear distinction between server and client state
6. **Real-time Integration**: Better integration with real-time updates

## Next Steps

1. Update components to use React Query hooks instead of store methods
2. Add `useStoreSync()` to the main App component
3. Update real-time handlers to use React Query invalidation
4. Test the new data flow thoroughly
5. Remove deprecated store methods once migration is complete

## Notes

- The store factory (`storeFactory.js`) is now deprecated
- All CRUD operations should use React Query mutations
- Store selectors remain unchanged and continue to work
- Real-time subscriptions are simplified and focus on business logic only
