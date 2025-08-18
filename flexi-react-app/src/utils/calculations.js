/**
 * Utility functions for common calculations
 * Pure functions that can be used anywhere in the application
 */

/**
 * Calculate percentage with bounds checking
 */
export const calculatePercentage = (value, total, min = 0, max = 100) => {
  if (!total || total === 0) return min;
  const percentage = (value / total) * 100;
  return Math.max(min, Math.min(max, percentage));
};

/**
 * Calculate time difference in hours
 */
export const calculateTimeDifference = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  
  return diffMs / (1000 * 60 * 60); // Convert to hours
};

/**
 * Calculate production efficiency
 */
export const calculateEfficiency = (actualTime, standardTime) => {
  if (!standardTime || standardTime === 0) return 0;
  return (standardTime / actualTime) * 100;
};

/**
 * Calculate cost per unit
 */
export const calculateCostPerUnit = (totalCost, quantity) => {
  if (!quantity || quantity === 0) return 0;
  return totalCost / quantity;
};

/**
 * Calculate total cost from hourly rate and time
 */
export const calculateTotalCost = (hourlyRate, hours) => {
  if (!hourlyRate || !hours) return 0;
  return hourlyRate * hours;
};

/**
 * Round to specified decimal places
 */
export const roundToDecimals = (value, decimals = 2) => {
  if (typeof value !== 'number') return 0;
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Calculate machine utilization percentage
 */
export const calculateMachineUtilization = (scheduledHours, availableHours) => {
  if (!availableHours || availableHours === 0) return 0;
  return Math.min(100, (scheduledHours / availableHours) * 100);
};

/**
 * Calculate lead time in days
 */
export const calculateLeadTime = (orderDate, deliveryDate) => {
  if (!orderDate || !deliveryDate) return 0;
  
  const order = new Date(orderDate);
  const delivery = new Date(deliveryDate);
  const diffTime = delivery - order;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

/**
 * Calculate optimal batch size based on setup time and run time
 */
export const calculateOptimalBatchSize = (setupTime, runTimePerUnit, targetEfficiency = 0.8) => {
  if (!setupTime || !runTimePerUnit) return 0;
  
  // Formula: batch_size = setup_time / (run_time_per_unit * (1/efficiency - 1))
  const efficiency = targetEfficiency / 100;
  const batchSize = setupTime / (runTimePerUnit * ((1 / efficiency) - 1));
  
  return Math.ceil(batchSize);
};

/**
 * Calculate weighted average
 */
export const calculateWeightedAverage = (values, weights) => {
  if (!values || !weights || values.length !== weights.length) return 0;
  
  const sum = values.reduce((acc, value, index) => {
    return acc + (value * weights[index]);
  }, 0);
  
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
  
  return totalWeight > 0 ? sum / totalWeight : 0;
};

export default {
  calculatePercentage,
  calculateTimeDifference,
  calculateEfficiency,
  calculateCostPerUnit,
  calculateTotalCost,
  roundToDecimals,
  calculateMachineUtilization,
  calculateLeadTime,
  calculateOptimalBatchSize,
  calculateWeightedAverage
};
