import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MachineForm from '../components/MachineForm';
import StickyHeader from '../components/StickyHeader';
import { useMachineStore, useUIStore, useMainStore } from '../store';

function MachineryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getMachineById } = useMachineStore();
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
           return <div className="text-center py-2 text-red-600 text-[10px]">Macchina non trovata.</div>;
  }

  // Allow access if work center is selected or if BOTH is selected (which allows any work center)
  if (!selectedWorkCenter) {
           return <div className="text-center py-2 text-red-600 text-[10px]">Seleziona un centro di lavoro per gestire le macchine.</div>;
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm border">
      {isEditMode && (
        <>
          <StickyHeader title={`Modifica Macchina: ${machine?.machine_name}`} />
          <div className="flex justify-end mb-1">
                       <Link to={`/machinery/${id}/calendar`} className="inline-flex items-center px-1 py-1 border border-gray-300 rounded shadow-sm text-[10px] font-medium text-gray-700 bg-white hover:bg-gray-50">
              Visualizza Calendario
            </Link>
          </div>
        </>
      )}
      <MachineForm machineToEdit={machine} />
    </div>
  );
}

export default MachineryFormPage;
