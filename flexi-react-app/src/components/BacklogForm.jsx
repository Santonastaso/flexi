import React, { useState, useEffect } from 'react';
import { appStore } from '../scripts/store';
import { BusinessLogicService } from '../scripts/businessLogicService';

function BacklogForm() {
  const initialFormData = {
    odp_number: '', article_code: '', production_lot: '', work_center: '',
    nome_cliente: '', description: '', delivery_date: '', bag_height: '',
    bag_width: '', bag_step: '', seal_sides: '3', product_type: '',
    quantity: '', quantity_per_box: '', quantity_completed: 0,
    internal_customer_code: '', external_customer_code: '',
    customer_order_ref: '', department: '', fase: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [calculationResults, setCalculationResults] = useState(null);
  const [filteredPhases, setFilteredPhases] = useState([]);
  const [phaseSearch, setPhaseSearch] = useState('');
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  
  const businessLogic = new BusinessLogicService();

  useEffect(() => {
    const state = appStore.getState();
    setPhases(state.phases || []);
  }, []);

  useEffect(() => {
    if (formData.article_code) {
      const department = businessLogic.auto_determine_department(formData.article_code);
      const work_center = businessLogic.auto_determine_work_center(formData.article_code);
      setFormData(prev => ({ ...prev, department, work_center, fase: '' }));
      setPhaseSearch('');
      setSelectedPhase(null);
    }
  }, [formData.article_code]);

  useEffect(() => {
    if (formData.department || formData.work_center) {
      const relevantPhases = phases.filter(p => 
        (!formData.department || p.department === formData.department) &&
        (!formData.work_center || p.work_center === formData.work_center)
      );
      const searchFiltered = relevantPhases.filter(p => p.name.toLowerCase().includes(phaseSearch.toLowerCase()));
      setFilteredPhases(searchFiltered);
    } else {
      setFilteredPhases([]);
    }
  }, [phaseSearch, formData.department, formData.work_center, phases]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhaseSelect = (phase) => {
    setFormData(prev => ({ ...prev, fase: phase.id }));
    setSelectedPhase(phase);
    setPhaseSearch(phase.name);
    setDropdownVisible(false);
    setCalculationResults(null); // Reset calculations when phase changes
  };

  const handleCalculate = () => {
    if (!selectedPhase || !formData.quantity || !formData.bag_step) {
      alert("Please select a phase and enter Quantity and Bag Step to calculate.");
      return;
    }
    const results = businessLogic.calculate_production_metrics(selectedPhase, formData.quantity, formData.bag_step);
    setCalculationResults(results);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!calculationResults) {
      alert("Please calculate production metrics before adding to the backlog.");
      return;
    }
    const orderData = {
      ...formData,
      duration: calculationResults.totals.duration,
      cost: calculationResults.totals.cost,
      status: 'NOT SCHEDULED',
    };
    appStore.addOdpOrder(orderData);
    setFormData(initialFormData);
    setPhaseSearch('');
    setSelectedPhase(null);
    setCalculationResults(null);
  };

  return (
    <div className="content-section">
      <h2>Create ODP</h2>
      <form onSubmit={handleSubmit}>
        {/* IDENTIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">🏷️ Identificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="odp_number">ODP Number *</label>
              <input 
                type="text" 
                id="odp_number" 
                name="odp_number" 
                value={formData.odp_number} 
                onChange={handleChange} 
                placeholder="ODP Number" 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="article_code">Article Code *</label>
              <input 
                type="text" 
                id="article_code" 
                name="article_code" 
                value={formData.article_code} 
                onChange={handleChange} 
                placeholder="Article Code" 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="production_lot">External Article Code *</label>
              <input 
                type="text" 
                id="production_lot" 
                name="production_lot" 
                value={formData.production_lot} 
                onChange={handleChange} 
                placeholder="External Article Code" 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="work_center">Work Center</label>
              <input 
                type="text" 
                id="work_center" 
                name="work_center" 
                value={formData.work_center} 
                onChange={handleChange} 
                placeholder="Work Center" 
                readOnly 
              />
            </div>
            <div className="form-group">
              <label htmlFor="nome_cliente">Customer Name</label>
              <input 
                type="text" 
                id="nome_cliente" 
                name="nome_cliente" 
                value={formData.nome_cliente} 
                onChange={handleChange} 
                placeholder="Customer Name" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea 
                id="description" 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                placeholder="Description" 
                rows="2"
              />
            </div>
          </div>
        </div>

        {/* SPECIFICHE TECNICHE Section */}
        <div className="form-section">
          <h3 className="section-title">🔧 Specifiche Tecniche</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="bag_height">Bag Height (mm) *</label>
              <input 
                type="number" 
                id="bag_height" 
                name="bag_height" 
                value={formData.bag_height} 
                onChange={handleChange} 
                placeholder="Bag Height" 
                min="0" 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="bag_width">Bag Width (mm) *</label>
              <input 
                type="number" 
                id="bag_width" 
                name="bag_width" 
                value={formData.bag_width} 
                onChange={handleChange} 
                placeholder="Bag Width" 
                min="0" 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="bag_step">Bag Step (mm) *</label>
              <input 
                type="number" 
                id="bag_step" 
                name="bag_step" 
                value={formData.bag_step} 
                onChange={handleChange} 
                placeholder="Bag Step" 
                min="0" 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="seal_sides">Seal Sides</label>
              <select 
                id="seal_sides" 
                name="seal_sides" 
                value={formData.seal_sides} 
                onChange={handleChange}
              >
                <option value="3">3 sides</option>
                <option value="4">4 sides</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="product_type">Product Type *</label>
              <select 
                id="product_type" 
                name="product_type" 
                value={formData.product_type} 
                onChange={handleChange} 
                required
              >
                <option value="">Select product type</option>
                <option value="crema">Crema</option>
                <option value="liquido">Liquido</option>
                <option value="polveri">Polveri</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Quantity *</label>
              <input 
                type="number" 
                id="quantity" 
                name="quantity" 
                value={formData.quantity} 
                onChange={handleChange} 
                placeholder="Quantity" 
                min="0" 
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantity_per_box">Qty per Box</label>
              <input 
                type="number" 
                id="quantity_per_box" 
                name="quantity_per_box" 
                value={formData.quantity_per_box} 
                onChange={handleChange} 
                placeholder="Qty per Box" 
                min="0" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantity_completed">Qty Completed</label>
              <input 
                type="number" 
                id="quantity_completed" 
                name="quantity_completed" 
                value={formData.quantity_completed} 
                onChange={handleChange} 
                placeholder="Qty Completed" 
                min="0" 
              />
            </div>
          </div>
        </div>

        {/* DATI LAVORAZIONE & PIANIFICAZIONE Section */}
        <div className="form-section">
          <h3 className="section-title">⚙️ Dati Lavorazione & Pianificazione</h3>
          <div className="form-grid form-grid--3-cols">
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input 
                type="text" 
                id="department" 
                name="department" 
                value={formData.department} 
                placeholder="Department" 
                readOnly 
              />
            </div>
            <div className="form-group">
              <label htmlFor="phase_search">Search Production Phase *</label>
              <div className="searchable-dropdown">
                <input 
                  type="text" 
                  id="phase_search"
                  value={phaseSearch} 
                  onChange={(e) => setPhaseSearch(e.target.value)} 
                  onFocus={() => setDropdownVisible(true)} 
                  onBlur={() => setTimeout(() => setDropdownVisible(false), 150)} 
                  placeholder="Search Production Phase" 
                  required 
                />
                {isDropdownVisible && filteredPhases.length > 0 && (
                  <div className="dropdown-options">
                    {filteredPhases.map(phase => (
                      <div 
                        key={phase.id} 
                        className="dropdown-option" 
                        onMouseDown={() => handlePhaseSelect(phase)}
                      >
                        <span className="phase-name">{phase.name}</span>
                        <span className="phase-description">{phase.contenuto_fase || 'No description'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="delivery_date">Delivery Date *</label>
              <input 
                type="datetime-local" 
                id="delivery_date" 
                name="delivery_date" 
                value={formData.delivery_date} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>
        </div>

        {/* Selected Phase Parameters */}
        {selectedPhase && (
          <div className="form-section">
            <h3 className="section-title">📊 Selected Phase Parameters</h3>
            <div className="form-grid form-grid--3-cols">
              {selectedPhase.department === 'STAMPA' ? (
                <>
                  <div className="form-group">
                    <label>Print Speed:</label>
                    <div className="parameter-value">{selectedPhase.v_stampa} mt/h</div>
                  </div>
                  <div className="form-group">
                    <label>Print Setup:</label>
                    <div className="parameter-value">{selectedPhase.t_setup_stampa} h</div>
                  </div>
                  <div className="form-group">
                    <label>Print Cost:</label>
                    <div className="parameter-value">€{selectedPhase.costo_h_stampa}/h</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Package Speed:</label>
                    <div className="parameter-value">{selectedPhase.v_conf} pz/h</div>
                  </div>
                  <div className="form-group">
                    <label>Package Setup:</label>
                    <div className="parameter-value">{selectedPhase.t_setup_conf} h</div>
                  </div>
                  <div className="form-group">
                    <label>Package Cost:</label>
                    <div className="parameter-value">€{selectedPhase.costo_h_conf}/h</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Production Calculation Results */}
        {calculationResults && (
          <div className="form-section">
            <h3 className="section-title">🧮 Production Calculation Results</h3>
            <div className="form-grid form-grid--2-cols">
              <div className="form-group">
                <label>Total Duration (hours):</label>
                <div className="result-value">{calculationResults.totals.duration.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label>Total Cost (€):</label>
                <div className="result-value">{calculationResults.totals.cost.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleCalculate} disabled={!selectedPhase}>
            Calculate
          </button>
          <button type="submit" className="btn btn-primary" disabled={!calculationResults}>
            Add to Backlog
          </button>
        </div>
      </form>
    </div>
  );
}

export default BacklogForm;