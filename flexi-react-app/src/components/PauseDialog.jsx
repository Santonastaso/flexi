import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

function PauseDialog({ isOpen, onClose, onCreatePause, machineId, machineName }) {
  const [duration, setDuration] = useState('1');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const durationValue = parseFloat(duration);
    
    if (isNaN(durationValue) || durationValue <= 0) {
      alert('Inserisci una durata valida maggiore di 0');
      return;
    }

    setIsCreating(true);
    try {
      await onCreatePause(machineId, durationValue);
      setDuration('1'); // Reset
      onClose();
    } catch (error) {
      console.error('Error creating pause:', error);
      alert('Errore nella creazione della pausa');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setDuration('1'); // Reset on close
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Pausa</DialogTitle>
          <DialogDescription>
            Crea una pausa nella coda di <strong>{machineName}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="duration" className="text-right">
              Durata (ore)
            </Label>
            <Input
              id="duration"
              type="number"
              step="0.5"
              min="0.5"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="col-span-3"
              disabled={isCreating}
            />
          </div>
          
          <div className="text-xs text-gray-500 ml-auto">
            La pausa verrà aggiunta alla fine della coda
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isCreating}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? 'Creazione...' : 'Crea Pausa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PauseDialog;

