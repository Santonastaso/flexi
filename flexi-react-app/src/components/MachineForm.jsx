import React,  { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useProductionCalculations } from '../hooks';

function MachineForm() {
  const initialFormData = {
    department: 'STAMPA',
    machine_type: '',
    machine_name: '',
    work_center: 'ZANICA',
    min_web_width: '100',
    max_web_width: '1000',
    min_bag_height: '50',
    max_bag_height: '500',
    standard_speed: '',
    setup_time_standard: '0.5',
    changeover_color: '0.25',
    changeover_material: '0.75',
    active_shifts: ['T1'],
    status: 'ACTIVE',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [validMachineTypes, setValidMachineTypes] = useState([]);
  
  // Use modern hook instead of BusinessLogicService class
  const { getValidMachineTypes } = useProductionCalculations();
  
  // Get addMachine action from Zustand store
  const addMachine = useStore(state => state.addMachine);

  useEffect(() => {
    const types = getValidMachineTypes(formData.department);
    setValidMachineTypes(types);
    if (!types.includes(formData.machine_type)) {
      setFormData(prev => ({ ...prev, machine_type: '' }));
    }
  }, [formData.department, getValidMachineTypes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleShiftChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      const shifts = prev.active_shifts;
      if (checked) {
        return { ...prev, active_shifts: [...shifts, value] };
      } else {
        return { ...prev, active_shifts: shifts.filter(s => s !== value) };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addMachine(formData);
    setFormData(initialFormData); // Reset form
  };

  return (
    <div className="content-section">
      <h2>Add Machine</h2>
      <form onSubmit={handleSubmit}>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">🏷️ Identificazione</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group">
              <label htmlFor="department">Department *</label>
              <select id="department" name="department" value={formData.department} onChange={handleChange} required>
                <option value="STAMPA">STAMPA</option>
                <option value="CONFEZIONAMENTO">CONFEZIONAMENTO</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="machine_type">Machine Type *</label>
              <select id="machine_type" name="machine_type" value={formData.machine_type} onChange={handleChange} required>
                <option value="">Select machine type</option>
                {validMachineTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="machine_name">Machine Name *</label>
              <input type="text" id="machine_name" name="machine_name" value={formData.machine_name} onChange={handleChange} placeholder="Descriptive name" required />
            </div>
            <div className="form-group">
              <label htmlFor="work_center">Work Center *</label>
              <select id="work_center" name="work_center" value={formData.work_center} onChange={handleChange} required>
                <option value="ZANICA">ZANICA</option>
                <option value="BUSTO_GAROLFO">BUSTO GAROLFO</option>
              </select>
            </div>
          </div>
        </div>

        {/* CAPACITÀ TECNICHE Section */}
        <div className="form-section">
          <h3 className="section-title">🔧 Capacità Tecniche</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="min_web_width">Min Web Width (mm)</label>
              <input type="number" id="min_web_width" name="min_web_width" value={formData.min_web_width} onChange={handleChange} min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="max_web_width">Max Web Width (mm) *</label>
              <input type="number" id="max_web_width" name="max_web_width" value={formData.max_web_width} onChange={handleChange} min="0" required />
            </div>
            <div className="form-group">
              <label htmlFor="min_bag_height">Min Bag Height (mm)</label>
              <input type="number" id="min_bag_height" name="min_bag_height" value={formData.min_bag_height} onChange={handleChange} min="0" required />
            </div>
            <div className="form-group">
              <label htmlFor="max_bag_height">Max Bag Height (mm) *</label>
              <input type="number" id="max_bag_height" name="max_bag_height" value={formData.max_bag_height} onChange={handleChange} min="0" required />
            </div>
          </div>
        </div>

        {/* PERFORMANCE Section */}
        <div className="form-section">
          <h3 className="section-title">⚡ Performance</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="standard_speed">Standard Speed</label>
              <input type="number" id="standard_speed" name="standard_speed" value={formData.standard_speed} onChange={handleChange} placeholder="pz/h or mt/h" min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="setup_time_standard">Setup Time Standard (h)</label>
              <input type="number" id="setup_time_standard" name="setup_time_standard" value={formData.setup_time_standard} onChange={handleChange} min="0" step="0.1" />
            </div>
            {formData.department === 'STAMPA' && (
              <div className="form-group">
                <label htmlFor="changeover_color">Changeover Color (h)</label>
                <input type="number" id="changeover_color" name="changeover_color" value={formData.changeover_color} onChange={handleChange} min="0" step="0.1" />
              </div>
            )}
            {formData.department === 'CONFEZIONAMENTO' && (
              <div className="form-group">
                <label htmlFor="changeover_material">Material Changeover (h)</label>
                <input type="number" id="changeover_material" name="changeover_material" value={formData.changeover_material} onChange={handleChange} min="0" step="0.1" />
              </div>
            )}
          </div>
        </div>
        
        {/* DISPONIBILITÀ Section */}
        <div className="form-section">
            <h3 className="section-title">📅 Disponibilità</h3>
            <div className="form-group">
                <label>Active Shifts</label>
                <div className="checkbox-group">
                    <label><input type="checkbox" value="T1" checked={formData.active_shifts.includes('T1')} onChange={handleShiftChange} /> T1</label>
                    <label><input type="checkbox" value="T2" checked={formData.active_shifts.includes('T2')} onChange={handleShiftChange} /> T2</label>
                    <label><input type="checkbox" value="T3" checked={formData.active_shifts.includes('T3')} onChange={handleShiftChange} /> T3</label>
                </div>
            </div>
        </div>

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button type="submit" className="btn btn-primary">Add Machine</button>
        </div>
      </form>
    </div>
  );
}

export default MachineForm;
