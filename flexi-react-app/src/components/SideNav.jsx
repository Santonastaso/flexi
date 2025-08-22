import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useStore } from '../store/useStore';
import { AppConfig } from '../services/config';
import logo from '/assets/logo.svg';

function SideNav() {
  const location = useLocation();
  const currentPage = location.pathname;
  const { user, signOut, isAuthenticated } = useAuth();
  const selectedWorkCenter = useStore(state => state.selectedWorkCenter);
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
  
  // Monitor real-time connection status
  useEffect(() => {
    if (!AppConfig.SUPABASE.ENABLE_REALTIME) return;
    
    const checkRealtimeStatus = () => {
      if (window.realtimeChannel) {
        setRealtimeStatus('connected');
      } else {
        setRealtimeStatus('disconnected');
      }
    };
    
    checkRealtimeStatus();
    const interval = setInterval(checkRealtimeStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

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
    } catch (error) {
      // Handle error silently
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Link to="/">
          <img src={logo} alt="Flexi" />
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
            {selectedWorkCenter && (
              <div className="user-work-center">
                <span className="work-center-badge">🏭 {selectedWorkCenter}</span>
              </div>
            )}
            {AppConfig.SUPABASE.ENABLE_REALTIME && (
              <div className="realtime-status">
                <span className={`status-indicator ${realtimeStatus}`}>
                  {realtimeStatus === 'connected' ? '🟢' : '🔴'} 
                  {realtimeStatus === 'connected' ? 'Live' : 'Offline'}
                </span>
              </div>
            )}
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
