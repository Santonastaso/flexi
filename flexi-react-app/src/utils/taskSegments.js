/**
 * Task Segment Utilities
 * Simple functions for working with task segments (split tasks)
 * Replaces the complex SplitTaskManager class with lean utility functions
 */

/**
 * Get segment information from a task
 * Parses the description field which contains segment data
 */
export const getTaskSegments = (task) => {
  if (!task || !task.description || task.status !== 'SCHEDULED') {
    return null;
  }
  
  try {
    const parsed = JSON.parse(task.description);
    if (parsed.segments && Array.isArray(parsed.segments)) {
      return parsed;
    }
  } catch (error) {
    // Invalid JSON, return null
  }
  
  return null;
};

/**
 * Check if a task is split across multiple segments
 */
export const isTaskSplit = (task) => {
  const segments = getTaskSegments(task);
  return segments && segments.segments && segments.segments.length > 1;
};

/**
 * Get the number of segments for a task
 */
export const getSegmentCount = (task) => {
  const segments = getTaskSegments(task);
  return segments?.segments?.length || 0;
};

/**
 * Create segment info object for storage in task.description
 */
export const createSegmentInfo = (segments, originalDuration) => {
  return {
    segments: segments.map(s => ({
      start: s.start instanceof Date ? s.start.toISOString() : s.start,
      end: s.end instanceof Date ? s.end.toISOString() : s.end,
      duration: s.duration
    })),
    totalSegments: segments.length,
    originalDuration: originalDuration,
    wasSplit: segments.length > 1
  };
};

/**
 * Check if task is a pause task
 */
export const isPauseTask = (task) => {
  if (!task || !task.description) return false;
  
  try {
    const parsed = JSON.parse(task.description);
    return parsed.is_pause === true;
  } catch {
    return false;
  }
};
