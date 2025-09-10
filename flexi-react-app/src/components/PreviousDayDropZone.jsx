import React, { useState, useCallback, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, subDays } from 'date-fns';

const PreviousDayDropZone = ({ currentDate, onNavigateToPreviousDay, isDragOver }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [navigationTimer, setNavigationTimer] = useState(null);
  
  // Use pure UTC date arithmetic - no timezone conversion
  const previousDay = subDays(currentDate, 1);
  const previousDayFormatted = format(previousDay, 'yyyy-MM-dd');
  
  const { setNodeRef } = useDroppable({
    id: 'previous-day-drop-zone',
    data: { 
      type: 'previous-day', 
      targetDate: previousDay,
      currentDate: currentDate 
    },
  });

  // Handle drag over with timer for smooth navigation
  useEffect(() => {
    if (isDragOver && !navigationTimer) {
      // Start timer to navigate after a short delay
      const timer = setTimeout(() => {
        onNavigateToPreviousDay();
        setNavigationTimer(null);
      }, 1600); // 1600ms delay for smooth transition
      
      setNavigationTimer(timer);
    } else if (!isDragOver && navigationTimer) {
      // Clear timer if drag leaves the zone
      clearTimeout(navigationTimer);
      setNavigationTimer(null);
    }
    
    return () => {
      if (navigationTimer) {
        clearTimeout(navigationTimer);
      }
    };
  }, [isDragOver, onNavigateToPreviousDay, navigationTimer]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleDrop = useCallback(() => {
    // Clear any pending timer and navigate immediately
    if (navigationTimer) {
      clearTimeout(navigationTimer);
      setNavigationTimer(null);
    }
    onNavigateToPreviousDay();
  }, [onNavigateToPreviousDay, navigationTimer]);

  const isActive = isDragOver || isHovered || navigationTimer;

  return (
    <div
      ref={setNodeRef}
      className={`previous-day-drop-zone ${isActive ? 'active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleDrop}
      title={`Trascina qui per andare al giorno precedente (${previousDayFormatted})`}
    >
      <div className="previous-day-content">
        <div className="previous-day-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
          </svg>
        </div>
      </div>
      
      {/* Animated background effect */}
      <div className="previous-day-bg-effect" />
      
      {/* Pulse animation when active */}
      {isActive && (
        <div className="previous-day-pulse" />
      )}
    </div>
  );
};

export default PreviousDayDropZone;
