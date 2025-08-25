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
    { href: '/', label: 'Home' },
    { 
      href: '/machinery', 
      label: 'Macchine',
      subLinks: [
        { href: '/machinery', label: 'Lista' },
        { href: '/machinery/add', label: 'Aggiungi' }
      ]
    },
    { 
      href: '/phases', 
      label: 'Fasi',
      subLinks: [
        { href: '/phases', label: 'Lista' },
        { href: '/phases/add', label: 'Aggiungi' }
      ]
    },
    { 
      href: '/backlog', 
      label: 'Backlog',
      subLinks: [
        { href: '/backlog', label: 'Lista' },
        { href: '/backlog/add', label: 'Aggiungi' }
      ]
    },
    { href: '/scheduler', label: 'Scheduler' }
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
            <span className="logo-flex">flex</span>
            <span className="logo-i">i</span>
          </Link>
        </div>
        
        <div className="sidebar-links">
          <h3 className="sidebar-section-title">NAVIGATION</h3>
          <Link to="/login" className="sidebar-link">
            <span>Accedi</span>
          </Link>
          <Link to="/signup" className="sidebar-link">
            <span>Registrati</span>
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
          <span className="logo-flex">flex</span>
          <span className="logo-i">i</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="sidebar-links">
        <h3 className="sidebar-section-title">NAVIGATION</h3>
        {navLinks.map((link) => {
          const isActive = location.pathname === link.href || 
            (link.subLinks && link.subLinks.some(subLink => location.pathname === subLink.href));
          
          return (
            <div key={link.href} className="nav-item">
              <Link
                to={link.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span>{link.label}</span>
              </Link>
              {link.subLinks && (
                <div className="sub-nav">
                  {link.subLinks.map((subLink) => (
                    <Link
                      key={subLink.href}
                      to={subLink.href}
                      className={`sub-nav-link ${location.pathname === subLink.href ? 'active' : ''}`}
                    >
                      <span>{subLink.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
            <span className="status-indicator offline">
              OFFLINE
            </span>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="sidebar-actions">
        <h3 className="sidebar-section-title">ACCOUNT</h3>
        <button onClick={handleSignOut} className="sidebar-action-btn signout-btn">
          <span>Esci</span>
        </button>
      </div>
    </nav>
  );
}

export default SideNav;
