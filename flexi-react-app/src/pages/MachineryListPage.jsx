import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import EditableCell from '../components/EditableCell';
import StickyHeader from '../components/StickyHeader';
import { useMachineStore, useUIStore, useMainStore } from '../store';
import { useMachineValidation, useErrorHandler } from '../hooks';
import { WORK_CENTERS } from '../constants';

function MachineryListPage() {
  // Use Zustand store to select state and actions
  const { machines, updateMachine, removeMachine } = useMachineStore();
  const { selectedWorkCenter, isLoading, isInitialized, showAlert, showConfirmDialog } = useUIStore();
  const { init, cleanup } = useMainStore();

  // Filter machines by work center
  const filteredMachines = useMemo(() => {
    if (!selectedWorkCenter) return [];
    if (selectedWorkCenter === WORK_CENTERS.BOTH) return machines;
    return machines.filter(machine => machine.work_center === selectedWorkCenter);
  }, [machines, selectedWorkCenter]);

  // Use modern validation hook
  const { validateMachine } = useMachineValidation();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('MachineryListPage');

  // Initialize store on component mount
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    
    // Cleanup function for component unmount
    return () => {
      cleanup();
    };
  }, [init, isInitialized, cleanup]);

  const columns = useMemo(() => [
    // Identificazione
    { header: 'ID Macchina', accessorKey: 'id' },
    { header: 'Tipo Macchina', accessorKey: 'machine_type' },
    { header: 'Nome Macchina', accessorKey: 'machine_name', cell: EditableCell },
    { header: 'Centro di Lavoro', accessorKey: 'work_center' },
    { header: 'Reparto', accessorKey: 'department' },
    { header: 'Stato', accessorKey: 'status', cell: EditableCell },
    // Capacità Tecniche
    { header: 'Larghezza Min (mm)', accessorKey: 'min_web_width', cell: EditableCell },
    { header: 'Larghezza Max (mm)', accessorKey: 'max_web_width', cell: EditableCell },
    { header: 'Altezza Min (mm)', accessorKey: 'min_bag_height', cell: EditableCell },
    { header: 'Altezza Max (mm)', accessorKey: 'max_bag_height', cell: EditableCell },
    // Performance
    { header: 'Velocità Std', accessorKey: 'standard_speed', cell: EditableCell },
    { header: 'Setup (h)', accessorKey: 'setup_time_standard', cell: EditableCell },
    { header: 'Cambio Colore (h)', accessorKey: 'changeover_color', cell: EditableCell },
    { header: 'Cambio Materiale (h)', accessorKey: 'changeover_material', cell: EditableCell },
    // Disponibilità
    { 
      header: 'Turni Attivi', 
      accessorKey: 'active_shifts',
      cell: info => Array.isArray(info.getValue()) ? info.getValue().join(', ') : ''
    },
    // Additional
    { 
      header: 'Creato il', 
      accessorKey: 'created_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
    { 
      header: 'Aggiornato il', 
      accessorKey: 'updated_at',
      cell: info => new Date(info.getValue()).toLocaleDateString()
    },
    // Calendar
    {
      header: 'Calendario',
      accessorKey: 'id',
      cell: info => (
        <Link 
          to={`/machinery/${info.getValue()}/calendar`}
          className="nav-btn today"
          style={{ textDecoration: 'none' }}
        >
          Visualizza Calendario
        </Link>
      )
    }
  ], []);

  const handleSaveMachine = async (updatedMachine) => {
    // Use the new validation hook
    const validationErrors = validateMachine(updatedMachine);
    
    if (validationErrors.length > 0) {
      // Show validation errors in the store alert
      showAlert(`Errori di validazione:\n${validationErrors.join('\n')}`, 'error');
      return;
    }
    
    await handleAsync(
      () => updateMachine(updatedMachine.id, updatedMachine),
      { context: 'Aggiorna Macchina', fallbackMessage: 'Aggiornamento macchina fallito' }
    );
  };

  const handleDeleteMachine = async (machineToDelete) => {
    showConfirmDialog(
      'Elimina Macchina',
      `Sei sicuro di voler eliminare "${machineToDelete.machine_name}"? Questa azione non può essere annullata.`,
      async () => {
        await handleAsync(
          () => removeMachine(machineToDelete.id),
          { context: 'Elimina Macchina', fallbackMessage: 'Eliminazione macchina fallita' }
        );
      },
      'danger'
    );
  };

  if (isLoading) {
    return <div>Caricamento dati macchine...</div>;
  }

  if (!selectedWorkCenter) {
    return <div className="error">Seleziona un centro di lavoro per visualizzare i dati delle macchine.</div>;
  }

  return (
    <div className="content-section">
      <StickyHeader title="Catalogo Macchine" />
      <DataTable
        columns={columns}
        data={filteredMachines}
        onSaveRow={handleSaveMachine}
        onDeleteRow={handleDeleteMachine}
      />
    </div>
  );
}

export default MachineryListPage;
