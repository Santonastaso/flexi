import React, { useState, useCallback, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, addDays } from 'date-fns';

const NextDayDropZone = ({ currentDate, onNavigateToNextDay, isDragOver }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [navigationTimer, setNavigationTimer] = useState(null);
  
  // Use pure UTC date arithmetic - no timezone conversion
  const nextDay = addDays(currentDate, 1);
  const nextDayFormatted = format(nextDay, 'yyyy-MM-dd');
  
  const { setNodeRef } = useDroppable({
    id: 'next-day-drop-zone',
    data: { 
      type: 'next-day', 
      targetDate: nextDay,
      currentDate: currentDate 
    },
  });

  // Handle drag over with timer for smooth navigation
  useEffect(() => {
    if (isDragOver && !navigationTimer) {
      // Start timer to navigate after a short delay
      const timer = setTimeout(() => {
        onNavigateToNextDay();
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
  }, [isDragOver, onNavigateToNextDay, navigationTimer]);

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
    onNavigateToNextDay();
  }, [onNavigateToNextDay, navigationTimer]);

  const isActive = isDragOver || isHovered || navigationTimer;

  return (
    <div
      ref={setNodeRef}
      className={`next-day-drop-zone ${isActive ? 'active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleDrop}
      title={`Trascina qui per andare al giorno successivo (${nextDayFormatted})`}
    >
      <div className="next-day-content">
        <div className="next-day-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </div>
      </div>
      
      {/* Animated background effect */}
      <div className="next-day-bg-effect" />
      
      {/* Pulse animation when active */}
      {isActive && (
        <div className="next-day-pulse" />
      )}
    </div>
  );
};

export default NextDayDropZone;
