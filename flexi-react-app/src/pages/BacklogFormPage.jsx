import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import BacklogForm from '../components/BacklogForm';
import StickyHeader from '../components/StickyHeader';
import { useOrderStore, useUIStore, useMainStore } from '../store';

function BacklogFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getOdpOrderById } = useOrderStore();
  const { selectedWorkCenter } = useUIStore();
  const { isLoading, isInitialized, init, cleanup } = useMainStore();

  // Check if this is edit mode (has ID) or add mode (no ID)
  const isEditMode = Boolean(id);
  const order = isEditMode ? getOdpOrderById(id) : null;

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

  // Redirect if order not found in edit mode
  useEffect(() => {
    if (isEditMode && !isLoading && !order) {
      navigate('/backlog', { replace: true });
    }
  }, [isEditMode, isLoading, order, navigate]);

  if (isLoading) {
    return <div>Caricamento...</div>;
  }

  if (isEditMode && !order) {
    return <div className="error">Ordine non trovato.</div>;
  }

  // Allow access if work center is selected or if BOTH is selected (which allows any work center)
  if (!selectedWorkCenter) {
    return <div className="error">Seleziona un centro di lavoro per gestire gli ordini del backlog.</div>;
  }

  return (
    <div className="content-section">
      <StickyHeader title={isEditMode ? `Modifica Ordine: ${order?.odp_number}` : 'Aggiungi Nuovo Ordine'} />
      <BacklogForm onSuccess={undefined} orderToEdit={order} />
    </div>
  );
}

export default BacklogFormPage;
