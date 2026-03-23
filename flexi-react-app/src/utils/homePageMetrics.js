import { MACHINE_STATUSES } from '../constants';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { ITALY_TIMEZONE } from './dateFormatting';

/**
 * Calculate comprehensive metrics for the home page dashboard
 * @param {Array} machines - Array of machine objects
 * @param {Array} orders - Array of order objects
 * @returns {Object} Calculated metrics object
 */
export const calculateHomeMetrics = (machines, orders) => {
  // Group machines by work center and status
  const machinesByWorkCenter = machines.reduce((acc, machine) => {
    const center = machine.work_center || 'Unknown';
    if (!acc[center]) {
      acc[center] = {
        [MACHINE_STATUSES.ACTIVE]: 0,
        [MACHINE_STATUSES.INACTIVE]: 0,
      };
    }
    acc[center][machine.status] = (acc[center][machine.status] || 0) + 1;
    return acc;
  }, {});

  // Calculate completed tasks this week (Monday 00:00 CET as boundary)
  const now = new Date();
  const nowInCET = toZonedTime(now, ITALY_TIMEZONE);
  const dayOfWeek = nowInCET.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  // Build CET Monday midnight and convert to proper UTC timestamp
  const mondayCET = new Date(nowInCET);
  mondayCET.setDate(nowInCET.getDate() - daysToSubtract);
  mondayCET.setHours(0, 0, 0, 0);
  const startOfWeek = fromZonedTime(mondayCET, ITALY_TIMEZONE);

  const completedThisWeek = orders.filter(order => {
    if (!order.completion_date) return false;
    const completionDate = new Date(order.completion_date);
    return completionDate >= startOfWeek;
  }).length;

  // Tasks currently in work in progress
  const tasksInWip = orders.filter(order =>
    ['SCHEDULED', 'IN PROGRESS'].includes(order.status)
  ).length;

  // Delayed tasks (past delivery_date and not completed)
  const delayedTasks = orders.filter(order => {
    if (!order.delivery_date) return false;
    const dueDate = new Date(order.delivery_date + 'T23:59:59');
    return dueDate < now && (order.quantity_completed || 0) < (order.quantity || 0);
  }).length;

  // Total active machines
  const activeMachines = machines.filter(m => m.status === MACHINE_STATUSES.ACTIVE).length;

  // Tasks per day (start date) for the last 7 days and next 7 days (14 days total)
  const tasksPerDay = {};
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  orders.forEach(order => {
    if (order.scheduled_start_time) {
      const startDate = new Date(order.scheduled_start_time);
      if (startDate >= sevenDaysAgo && startDate <= sevenDaysFromNow) {
        const dateStr = formatInTimeZone(startDate, ITALY_TIMEZONE, 'yyyy-MM-dd');
        tasksPerDay[dateStr] = (tasksPerDay[dateStr] || 0) + 1;
      }
    }
  });

  // Weekly cost and duration metrics
  const weeklyOrders = orders.filter(order => {
    if (!order.scheduled_start_time) return false;
    const startDate = new Date(order.scheduled_start_time);
    return startDate >= startOfWeek;
  });

  const weeklyCosts = weeklyOrders
    .filter(order => order.cost && order.cost > 0)
    .map(order => order.cost);
  
  const weeklyDurations = weeklyOrders
    .filter(order => order.duration && order.duration > 0)
    .map(order => order.duration);

  const avgWeeklyCost = weeklyCosts.length > 0 
    ? weeklyCosts.reduce((sum, cost) => sum + cost, 0) / weeklyCosts.length 
    : 0;
  
  const avgWeeklyDuration = weeklyDurations.length > 0 
    ? weeklyDurations.reduce((sum, duration) => sum + duration, 0) / weeklyDurations.length 
    : 0;

  // Calculate cost and duration matrices by work center and department
  const costMatrix = {};
  const durationMatrix = {};
  
  // Initialize matrices with department-first structure to match UI expectations
  const departments = ['STAMPA', 'CONFEZIONAMENTO'];
  const workCenters = ['ZANICA', 'BUSTO_GAROLFO'];
  
  departments.forEach(dept => {
    const deptLower = dept.toLowerCase();
    costMatrix[deptLower] = {};
    durationMatrix[deptLower] = {};
    
    workCenters.forEach(center => {
      // Create consistent keys for the matrix
      const centerKey = center === 'BUSTO_GAROLFO' ? 'busto_garolfo' : center.toLowerCase();
      
      // Filter orders by work center and department
      const deptOrders = orders.filter(order => {
        if (!order.work_center || !order.department) return false;
        return order.work_center === center && order.department === dept;
      });
      
      // Calculate average cost for this combination
      const validCosts = deptOrders
        .filter(order => order.cost && order.cost > 0)
        .map(order => order.cost);
      
      const avgCost = validCosts.length > 0 
        ? validCosts.reduce((sum, cost) => sum + cost, 0) / validCosts.length 
        : 0;
      
      // Calculate average duration for this combination
      const validDurations = deptOrders
        .filter(order => order.duration && order.duration > 0)
        .map(order => order.duration);
      
      const avgDuration = validDurations.length > 0 
        ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length 
        : 0;
      
      // Store in matrices with department-first structure
      costMatrix[deptLower][centerKey] = avgCost;
      durationMatrix[deptLower][centerKey] = avgDuration;
    });
  });

  return {
    machinesByWorkCenter,
    completedThisWeek,
    tasksInWip,
    delayedTasks,
    activeMachines,
    totalMachines: machines.length,
    totalOrders: orders.length,
    tasksPerDay,
    avgWeeklyCost,
    avgWeeklyDuration,
    weeklyOrdersCount: weeklyOrders.length,
    costMatrix,
    durationMatrix
  };
};
