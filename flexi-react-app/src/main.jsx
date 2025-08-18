import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Import CSS files in logical order
import './styles/base.css';           // CSS custom properties, reset, base styles, typography
import './styles/layout.css';         // Layout, sidebar, navigation
import './styles/forms.css';          // Forms, buttons, form components
import './styles/tables.css';         // Tables, data tables, in-table editing
import './styles/scheduler.css';      // Scheduler, calendar, Gantt chart
import './styles/dashboard.css';      // Dashboard metrics, charts, activity
import './styles/components.css';     // Modals, status badges, dropdowns
import './styles/error.css';          // Error boundaries, error handling

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
