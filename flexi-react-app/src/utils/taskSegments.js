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
