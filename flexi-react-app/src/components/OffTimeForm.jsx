import React, { useState } from 'react';
import { useStore } from '../store/useStore';

function OffTimeForm({ machineName, currentDate }) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const setMachineUnavailability = useStore(state => state.setMachineUnavailability);

  // Set default dates based on current date
  React.useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(tomorrow.toISOString().split('T')[0]);
  }, [currentDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('');

    try {
      // Validate dates
      if (new Date(startDate) > new Date(endDate)) {
        setStatus('warning: End date must be after start date');
        return;
      }

      if (startDate === endDate && startTime >= endTime) {
        setStatus('warning: End time must be after start time on the same day');
        return;
      }

      await setMachineUnavailability(machineName, startDate, endDate, startTime, endTime);
      setStatus('success: Off-time period set successfully');
      
      // Reset form
      setStartDate('');
      setStartTime('00:00');
      setEndDate('');
      setEndTime('23:59');
    } catch (error) {
      setStatus(`error: Failed to set off-time: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusClass = () => {
    if (status.startsWith('success:')) return 'success';
    if (status.startsWith('warning:')) return 'warning';
    if (status.startsWith('error:')) return 'error';
    return '';
  };

  const getStatusMessage = () => {
    return status.replace(/^(success|warning|error):\s*/, '');
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
      
      {status && (
        <div className={`off-time-status ${getStatusClass()}`}>
          {getStatusMessage()}
        </div>
      )}
    </div>
  );
}

export default OffTimeForm;
