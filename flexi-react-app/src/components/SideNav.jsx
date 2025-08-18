import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function SideNav() {
  const location = useLocation();
  const currentPage = location.pathname;

  const navLinks = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/machinery', label: 'Machinery', icon: '⚙️' },
    { href: '/phases', label: 'Phases', icon: '🔄' },
    { href: '/backlog', label: 'Backlog', icon: '📝' },
    { href: '/scheduler', label: 'Scheduler', icon: '📅' }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Link to="/">
          <img src="/assets/logo.svg" alt="Flexi" />
        </Link>
      </div>
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
    </div>
  );
}

export default SideNav;
