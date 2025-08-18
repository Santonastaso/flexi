import React, { useState } from 'react';
import { appStore } from '../scripts/store';

function PhasesForm() {
  const initialFormData = {
    name: '',
    department: 'STAMPA',
    numero_persone: 1,
    work_center: 'ZANICA',
    v_stampa: 6000,
    t_setup_stampa: 0.5,
    costo_h_stampa: 50,
    v_conf: 1000,
    t_setup_conf: 0.25,
    costo_h_conf: 40,
    contenuto_fase: '',
  };

  const [formData, setFormData] = useState(initialFormData);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    appStore.addPhase(formData);
    setFormData(initialFormData); // Reset form
  };

  return (
    <div className="content-section">
      <h2>Production Phases</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3 className="section-title">➕ Add New Phase</h3>
          <div className="form-grid form-grid--4-cols">
            <div className="form-group">
              <label htmlFor="name">Phase Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., High-Speed Printing" required />
            </div>
            <div className="form-group">
              <label htmlFor="department">Phase Type *</label>
              <select id="department" name="department" value={formData.department} onChange={handleChange} required>
                <option value="STAMPA">STAMPA</option>
                <option value="CONFEZIONAMENTO">CONFEZIONAMENTO</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="numero_persone">Number of People Required *</label>
              <input type="number" id="numero_persone" name="numero_persone" value={formData.numero_persone} onChange={handleChange} min="1" required />
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

        {/* Conditional Printing Parameters */}
        {formData.department === 'STAMPA' && (
          <div className="form-section">
            <h3>Printing Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_stampa">Printing Speed (mt/h)</label>
                <input type="number" id="v_stampa" name="v_stampa" value={formData.v_stampa} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_stampa">Setup Time (hours)</label>
                <input type="number" id="t_setup_stampa" name="t_setup_stampa" value={formData.t_setup_stampa} onChange={handleChange} min="0" step="0.1" />
              </div>
              <div className="form-group">
                <label htmlFor="costo_h_stampa">Hourly Cost (€/h)</label>
                <input type="number" id="costo_h_stampa" name="costo_h_stampa" value={formData.costo_h_stampa} onChange={handleChange} min="0" step="0.01" />
              </div>
            </div>
          </div>
        )}

        {/* Conditional Packaging Parameters */}
        {formData.department === 'CONFEZIONAMENTO' && (
          <div className="form-section">
            <h3>Packaging Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              <div className="form-group">
                <label htmlFor="v_conf">Packaging Speed (pz/h)</label>
                <input type="number" id="v_conf" name="v_conf" value={formData.v_conf} onChange={handleChange} min="0" />
              </div>
              <div className="form-group">
                <label htmlFor="t_setup_conf">Setup Time (hours)</label>
                <input type="number" id="t_setup_conf" name="t_setup_conf" value={formData.t_setup_conf} onChange={handleChange} min="0" step="0.1" />
              </div>
              <div className="form-group">
                <label htmlFor="costo_h_conf">Hourly Cost (€/h)</label>
                <input type="number" id="costo_h_conf" name="costo_h_conf" value={formData.costo_h_conf} onChange={handleChange} min="0" step="0.01" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="contenuto_fase">Phase Content Description</label>
              <textarea id="contenuto_fase" name="contenuto_fase" value={formData.contenuto_fase} onChange={handleChange} rows="3"></textarea>
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button type="submit" className="btn btn-primary">Add Phase</button>
        </div>
      </form>
    </div>
  );
}

export default PhasesForm;
