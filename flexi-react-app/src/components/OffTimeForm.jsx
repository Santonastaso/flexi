import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

function OffTimeForm({ machineId, currentDate }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  const setMachineUnavailability = useStore(state => state.setMachineUnavailability);
  const machines = useStore(state => state.machines);
  
  const machine = machines.find(m => m.id === machineId);
  const machineName = machine?.machine_name || 'Unknown Machine';

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(tomorrow.toISOString().split('T')[0]);
    setStartTime('09:00');
    setEndTime('17:00');
  }, [currentDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      await setMachineUnavailability(machineId, startDate, endDate, startTime, endTime);
      setMessage('Machine unavailability set successfully!');
      
      // Reset form
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusClass = () => {
    if (message.startsWith('success:')) return 'success';
    if (message.startsWith('warning:')) return 'warning';
    if (message.startsWith('error:')) return 'error';
    return '';
  };

  const getStatusMessage = () => {
    return message.replace(/^(success|warning|error):\s*/, '');
  };

  return (
    <div className="off-time-section">
      <h3>Set Off-Time Period</h3>
      
      <form onSubmit={handleSubmit} className="off-time-form">
        <div className="form-grid form-grid--4-cols">
          <div className="form-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="date-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="startTime">Start Time</label>
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="time-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="date-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endTime">End Time</label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="time-input"
              required
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button
            type="submit"
            className="set-off-time-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Setting...' : 'Set Off-Time'}
          </button>
        </div>
      </form>
      
      {message && (
        <div className={`off-time-status ${getStatusClass()}`}>
          {getStatusMessage()}
        </div>
      )}
    </div>
  );
}

export default OffTimeForm;
