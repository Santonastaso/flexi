import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import SideNav from './components/SideNav';
import MachineryPage from './pages/MachineryPage';
import PhasesPage from './pages/PhasesPage';
import BacklogPage from './pages/BacklogPage'; // Import this
import SchedulerPage from './pages/SchedulerPage'; // Import this

// A simple component for placeholder pages
const PlaceholderPage = ({ title }) => (
  <div className="content-section">
    <h2>{title}</h2>
    <p>This page has not been migrated to React yet.</p>
  </div>
);

// This component creates the main layout with the sidebar
const AppLayout = () => (
  <div className="main-content">
    <SideNav />
    <div className="page-container">
      <main>
        <Outlet /> {/* This is where the routed page component will be rendered */}
      </main>
    </div>
  </div>
);

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Define the component for the home page */}
        <Route index element={<PlaceholderPage title="Home" />} />
        
        {/* Add routes for your migrated pages */}
        <Route path="machinery" element={<MachineryPage />} />
        <Route path="phases" element={<PhasesPage />} />
        
        {/* Add routes for pages that are not yet migrated */}
        <Route path="backlog" element={<BacklogPage />} /> {/* Change this line */}
        <Route path="dashboard" element={<PlaceholderPage title="Dashboard" />} />
        <Route path="scheduler" element={<SchedulerPage />} /> {/* Change this line */}
      </Route>
    </Routes>
  );
}

export default App;
