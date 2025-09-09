import { supabase, handleSupabaseError } from './supabase/client';
import { safeAsync, handleApiError, AppError, ERROR_TYPES } from '../utils/errorHandling';
import { format, addDays } from 'date-fns';
import { AppConfig } from './config';

/**
 * Modern API service for data operations
 * Replaces the legacy storageService with clean, modern patterns
 */
class ApiService {
  /**
   * Initialize the API service
   */
  async init() {
    try {
      // Test connection
      const { error } = await supabase
        .from('machines')
        .select('count')
        .limit(1);
        
      if (error) {
        throw new AppError(`API initialization failed: ${error.message}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.init');
      }
      
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`API initialization failed: ${error.message}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.init');
    }
  }

  // ===== MACHINES =====
  
  async getMachines() {
    return safeAsync(async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_name');
        
      if (error) throw error;
      return data || [];
    }, 'getMachines');
  }

  async addMachine(machineData) {
    try {
      const { data, error } = await supabase
        .from('machines')
        .insert([machineData])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to add machine: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.addMachine');
    }
  }

  async updateMachine(id, updates) {
    try {
      const { data, error } = await supabase
        .from('machines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to update machine: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.updateMachine');
    }
  }

  async removeMachine(id) {
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (error) {
      throw new AppError(`Failed to remove machine: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.removeMachine');
    }
  }

  // ===== ODP ORDERS =====
  
  async getOdpOrders() {
    try {
      const { data, error } = await supabase
        .from('odp_orders')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new AppError(`Failed to fetch ODP orders: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.getOdpOrders');
    }
  }

  async getOdpOrder(id) {
    try {
      const { data, error } = await supabase
        .from('odp_orders')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to fetch ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.getOdpOrder');
    }
  }

  async addOdpOrder(orderData) {
    try {
      const { data, error } = await supabase
        .from('odp_orders')
        .insert([orderData])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to add ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.addOdpOrder');
    }
  }

  async updateOdpOrder(id, updates) {
    try {
      const { data, error } = await supabase
        .from('odp_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to update ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.updateOdpOrder');
    }
  }

  async removeOdpOrder(id) {
    try {
      const { error } = await supabase
        .from('odp_orders')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (error) {
      throw new AppError(`Failed to remove ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.removeOdpOrder');
    }
  }

  // ===== PHASES =====
  
  async getPhases() {
    try {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .order('name');
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new AppError(`Failed to fetch phases: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.getPhases');
    }
  }

  async addPhase(phaseData) {
    try {
      const { data, error } = await supabase
        .from('phases')
        .insert([phaseData])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to add phase: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.addPhase');
    }
  }

  async updatePhase(id, updates) {
    try {
      const { data, error } = await supabase
        .from('phases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to update phase: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.updatePhase');
    }
  }

  async removePhase(id) {
    try {
      const { error } = await supabase
        .from('phases')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (error) {
      throw new AppError(`Failed to remove phase: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.removePhase');
    }
  }

  // ===== MACHINE AVAILABILITY =====
  
  async getMachineAvailabilityForDateRange(machineId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .select('*')
        .eq('machine_id', machineId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new AppError(`Failed to fetch machine availability for date range: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.getMachineAvailabilityForDateRange');
    }
  }

  async getMachineAvailabilityForDate(machineId, dateStr) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .select('*')
        .eq('machine_id', machineId)
        .eq('date', dateStr)
        .maybeSingle();
        
      if (error) throw error;
      return data || null;
    } catch (error) {
      throw new AppError(`Failed to fetch machine availability: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.getMachineAvailabilityForDate');
    }
  }

  async getMachineAvailability(machineId, dateStr) {
    try {
      const data = await this.getMachineAvailabilityForDate(machineId, dateStr);
      return data?.unavailable_hours || [];
    } catch (error) {
      return [];
    }
  }

  async setMachineAvailability(machineId, dateStr, unavailableHours) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .upsert([{
          machine_id: machineId,
          date: dateStr,
          unavailable_hours: unavailableHours
        }], { onConflict: 'machine_id,date' })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to set machine availability: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.setMachineAvailability');
    }
  }

  async getMachineAvailabilityForDateAllMachines(dateStr) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .select('*')
        .eq('date', dateStr);
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new AppError(`Failed to fetch machine availability for all machines: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.getMachineAvailabilityForDateAllMachines');
    }
  }

  async getEventsByDate(dateStr) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .select('*')
        .eq('date', dateStr);
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new AppError(`Failed to fetch events by date: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.getEventsByDate');
    }
  }

  async setUnavailableHoursForRange(machineId, startDate, endDate, startTime, endTime) {
    try {
      // Parse start and end times to get hour ranges
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      // Generate array of hours to mark as unavailable
      const hoursToMark = [];
      for (let hour = startHour; hour < endHour; hour++) {
        hoursToMark.push(hour.toString());
      }
      
      // Convert dates to Date objects for iteration
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Iterate through each date in the range
      let currentDate = new Date(startDateObj);
      const results = [];
      
      while (currentDate <= endDateObj) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        // Get current unavailable hours for this date
        const currentData = await this.getMachineAvailabilityForDate(machineId, dateStr);
        const currentUnavailableHours = currentData?.unavailable_hours || [];
        
        // Add new hours to the existing ones (avoid duplicates)
        const newUnavailableHours = [...new Set([...currentUnavailableHours, ...hoursToMark])].sort((a, b) => parseInt(a) - parseInt(b));
        
        // Update the database
        const result = await this.setMachineAvailability(machineId, dateStr, newUnavailableHours);
        results.push(result);
        
        // Move to next date
        currentDate = addDays(currentDate, 1);
      }
      
      return results;
    } catch (error) {
      throw new AppError(`Failed to set unavailable hours for range: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.setUnavailableHoursForRange');
    }
  }

  async bulkUpsertMachineAvailability(records) {
    try {
      const { error } = await supabase
        .from('machine_availability')
        .upsert(records, { onConflict: 'machine_id,date' });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      throw new AppError(`Failed to bulk set machine availability: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, error, 'API.bulkUpsertMachineAvailability');
    }
  }

  // ===== REAL-TIME SUBSCRIPTIONS =====
  
  setupRealtimeSubscriptions(onOdpOrdersChange, onMachinesChange, onPhasesChange) {
    if (!AppConfig.SUPABASE.ENABLE_REALTIME) {
      return null;
    }
    
    const channel = supabase.channel('table-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'odp_orders' },
        onOdpOrdersChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        onMachinesChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'phases' },
        onPhasesChange
      )
      .subscribe((status) => {
        // Realtime subscription status handled silently
      });

    return channel;
  }

  cleanupRealtimeSubscriptions(channel) {
    if (channel) {
      try {
        channel.unsubscribe();
      } catch (error) {
        // Silent cleanup - subscription might already be closed
      }
    }
  }
}

// Create and export singleton instance
export const apiService = new ApiService();

export default apiService;
