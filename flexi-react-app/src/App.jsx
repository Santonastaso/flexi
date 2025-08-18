import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import SideNav from './components/SideNav';
import MachineryPage from './pages/MachineryPage';
import PhasesPage from './pages/PhasesPage';
import BacklogPage from './pages/BacklogPage';
import SchedulerPage from './pages/SchedulerPage';
import HomePage from './pages/HomePage';

// This component creates the main layout with the sidebar
const AppLayout = () => (
  <div className="main-content">
    <SideNav />
    <div className="page-container">
      <main>
        <Outlet />
      </main>
    </div>
  </div>
);

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Define the component for the home page */}
        <Route index element={<HomePage />} />
        
        {/* Add routes for your migrated pages */}
        <Route path="machinery" element={<MachineryPage />} />
        <Route path="phases" element={<PhasesPage />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="scheduler" element={<SchedulerPage />} />
      </Route>
    </Routes>
  );
}

export default App;
