import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function SideNav() {
  const location = useLocation();
  const currentPage = location.pathname;
  const { user, signOut, isAuthenticated } = useAuth();

  const navLinks = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/machinery', label: 'Machinery', icon: '⚙️' },
    { href: '/phases', label: 'Phases', icon: '🔄' },
    { href: '/backlog', label: 'Backlog', icon: '📝' },
    { href: '/scheduler', label: 'Scheduler', icon: '📅' }
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Link to="/">
          <img src="./assets/logo.svg" alt="Flexi" />
        </Link>
      </div>

      {/* User Profile Section */}
      {isAuthenticated && user && (
        <div className="sidebar-user">
          <div className="user-avatar">
            {user.user_metadata?.full_name ? 
              user.user_metadata.full_name.charAt(0).toUpperCase() : 
              user.email?.charAt(0).toUpperCase()
            }
          </div>
          <div className="user-info">
            <div className="user-name">
              {user.user_metadata?.full_name || 'User'}
            </div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-title">Navigation</div>
        <nav className="sidebar-nav">
          <ul>
            {navLinks.map(link => (
              <li key={link.href}>
                <Link to={link.href} className={currentPage === link.href ? 'active' : ''}>
                  <span className="nav-icon">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Authentication Section */}
      {isAuthenticated ? (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Account</div>
          <div className="sidebar-actions">
            <button 
              onClick={handleSignOut}
              className="sidebar-action-btn signout-btn"
              title="Sign Out"
            >
              <span className="nav-icon">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Account</div>
          <div className="sidebar-actions">
            <Link to="/login" className="sidebar-action-btn login-btn">
              <span className="nav-icon">🔑</span>
              <span>Sign In</span>
            </Link>
            <Link to="/signup" className="sidebar-action-btn signup-btn">
              <span className="nav-icon">➕</span>
              <span>Sign Up</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default SideNav;
