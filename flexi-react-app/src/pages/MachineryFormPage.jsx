import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MachineForm from '../components/MachineForm';
import StickyHeader from '../components/StickyHeader';
import { useMachineStore, useUIStore, useMainStore } from '../store';

function MachineryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { machines, getMachineById } = useMachineStore();
  const { selectedWorkCenter } = useUIStore();
  const { isLoading, isInitialized, init, cleanup } = useMainStore();

  // Check if this is edit mode (has ID) or add mode (no ID)
  const isEditMode = Boolean(id);
  const machine = isEditMode ? getMachineById(id) : null;

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

  // Redirect if machine not found in edit mode
  useEffect(() => {
    if (isEditMode && !isLoading && !machine) {
      navigate('/machinery', { replace: true });
    }
  }, [isEditMode, isLoading, machine, navigate]);

  if (isLoading) {
    return <div>Caricamento...</div>;
  }

  if (isEditMode && !machine) {
    return <div className="error">Macchina non trovata.</div>;
  }

  // Allow access if work center is selected or if BOTH is selected (which allows any work center)
  if (!selectedWorkCenter) {
    return <div className="error">Seleziona un centro di lavoro per gestire le macchine.</div>;
  }

  return (
    <div className="content-section">
      <StickyHeader title={isEditMode ? `Modifica Macchina: ${machine?.machine_name}` : 'Aggiungi Nuova Macchina'} />
      {isEditMode && (
        <div style={{ margin: '8px 24px', display: 'flex', justifyContent: 'flex-end' }}>
          <Link to={`/machinery/${id}/calendar`} className="nav-btn today">
            Visualizza Calendario
          </Link>
        </div>
      )}
      <MachineForm machineToEdit={machine} />
    </div>
  );
}

export default MachineryFormPage;
