import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../store';

function SideNav() {
  const { user, signOut } = useAuth();
  const { selectedWorkCenter } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { href: '/', label: 'Home', icon: '●' },
    { href: '/machinery', label: 'Machinery', icon: '●' },
    { href: '/phases', label: 'Phases', icon: '●' },
    { href: '/backlog', label: 'Backlog', icon: '●' },
    { href: '/scheduler', label: 'Scheduler', icon: '●' }
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (!user) {
    return (
      <nav className="sidebar">
        <div className="sidebar-logo">
          <Link to="/login">
            <span style={{ color: '#3498DB' }}>flex</span>
            <span style={{ color: '#27AE60' }}>i</span>
          </Link>
        </div>
        
        <div className="sidebar-links">
          <h3 className="sidebar-section-title">Navigation</h3>
          <Link to="/login" className="sidebar-link">
            <span>Login</span>
          </Link>
          <Link to="/signup" className="sidebar-link">
            <span>Sign Up</span>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Link to="/">
          <span style={{ color: '#3498DB' }}>flex</span>
          <span style={{ color: '#27AE60' }}>i</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="sidebar-links">
        <h3 className="sidebar-section-title">Navigation</h3>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className={`sidebar-link ${location.pathname === link.href ? 'active' : ''}`}
          >
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* User Profile */}
      <div className="sidebar-user">
        <div className="user-avatar">
          {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="user-info">
          <div className="user-email">{user.email}</div>
          {selectedWorkCenter && (
            <div className="work-center-badge">
              WC: {selectedWorkCenter}
            </div>
          )}
          <div className="realtime-status">
            <span className="status-indicator disconnected">
              OFFLINE
            </span>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="sidebar-actions">
        <h3 className="sidebar-section-title">Account</h3>
        <button onClick={handleSignOut} className="sidebar-action-btn signout-btn">
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}

export default SideNav;
