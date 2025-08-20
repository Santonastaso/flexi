import { supabase, handleSupabaseError } from './supabase/client';
import { toDateString, addDaysToDate } from '../utils/dateUtils';

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
        throw new Error(`API initialization failed: ${error.message}`);
      }
      
      console.log('✅ API service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ API service initialization failed:', error);
      throw error;
    }
  }

  // ===== MACHINES =====
  
  async getMachines() {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_name');
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to fetch machines: ${handleSupabaseError(error)}`);
    }
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
      throw new Error(`Failed to add machine: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to update machine: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to remove machine: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to fetch ODP orders: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to add ODP order: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to update ODP order: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to remove ODP order: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to fetch phases: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to add phase: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to update phase: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to remove phase: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to fetch machine availability for date range: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to fetch machine availability: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to set machine availability: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to fetch machine availability for all machines: ${handleSupabaseError(error)}`);
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
      throw new Error(`Failed to fetch events by date: ${handleSupabaseError(error)}`);
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
        const dateStr = toDateString(currentDate);
        
        // Get current unavailable hours for this date
        const currentData = await this.getMachineAvailabilityForDate(machineId, dateStr);
        const currentUnavailableHours = currentData?.unavailable_hours || [];
        
        // Add new hours to the existing ones (avoid duplicates)
        const newUnavailableHours = [...new Set([...currentUnavailableHours, ...hoursToMark])].sort((a, b) => parseInt(a) - parseInt(b));
        
        // Update the database
        const result = await this.setMachineAvailability(machineId, dateStr, newUnavailableHours);
        results.push(result);
        
        // Move to next date
        currentDate = addDaysToDate(currentDate, 1);
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to set unavailable hours for range: ${handleSupabaseError(error)}`);
    }
  }
}

// Create and export singleton instance
export const apiService = new ApiService();

export default apiService;
