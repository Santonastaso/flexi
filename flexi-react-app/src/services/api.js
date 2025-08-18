import { supabase, handleSupabaseError } from './supabase/client';

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
      const { data, error } = await supabase
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
  
  async getMachineAvailabilityForDateRange(machineName, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .select('*')
        .eq('machine_name', machineName)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to fetch machine availability for date range: ${handleSupabaseError(error)}`);
    }
  }

  async getMachineAvailabilityForDate(machineName, dateStr) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .select('*')
        .eq('machine_name', machineName)
        .eq('date', dateStr)
        .maybeSingle();
        
      if (error) throw error;
      return data || null;
    } catch (error) {
      throw new Error(`Failed to fetch machine availability: ${handleSupabaseError(error)}`);
    }
  }

  async setMachineAvailability(machineName, dateStr, unavailableHours) {
    try {
      const { data, error } = await supabase
        .from('machine_availability')
        .upsert([{
          machine_name: machineName,
          date: dateStr,
          unavailable_hours: unavailableHours
        }], { onConflict: 'machine_name,date' })
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

  async setUnavailableHoursForRange(machineName, startDate, endDate, startTime, endTime) {
    try {
      // This would need to be implemented based on your specific requirements
      // For now, returning a placeholder
      console.log('Setting unavailable hours for range:', { machineName, startDate, endDate, startTime, endTime });
      return true;
    } catch (error) {
      throw new Error(`Failed to set unavailable hours: ${handleSupabaseError(error)}`);
    }
  }

  // ===== snake_case aliases for backward compatibility and consistency =====
  async get_machines() { return this.getMachines(); }
  async add_machine(machineData) { return this.addMachine(machineData); }
  async update_machine(id, updates) { return this.updateMachine(id, updates); }
  async remove_machine(id) { return this.removeMachine(id); }

  async get_odp_orders() { return this.getOdpOrders(); }
  async add_odp_order(orderData) { return this.addOdpOrder(orderData); }
  async update_odp_order(id, updates) { return this.updateOdpOrder(id, updates); }
  async remove_odp_order(id) { return this.removeOdpOrder(id); }

  async get_phases() { return this.getPhases(); }
  async add_phase(phaseData) { return this.addPhase(phaseData); }
  async update_phase(id, updates) { return this.updatePhase(id, updates); }
  async remove_phase(id) { return this.removePhase(id); }

  async get_machine_availability_for_date_range(machineName, startDate, endDate) { return this.getMachineAvailabilityForDateRange(machineName, startDate, endDate); }
  async get_machine_availability_for_date(machineName, dateStr) { return this.getMachineAvailabilityForDate(machineName, dateStr); }
  async set_machine_availability(machineName, dateStr, unavailableHours) { return this.setMachineAvailability(machineName, dateStr, unavailableHours); }
  async get_machine_availability_for_date_all_machines(dateStr) { return this.getMachineAvailabilityForDateAllMachines(dateStr); }
  async get_events_by_date(dateStr) { return this.getEventsByDate(dateStr); }
  async set_unavailable_hours_for_range(machineName, startDate, endDate, startTime, endTime) { return this.setUnavailableHoursForRange(machineName, startDate, endDate, startTime, endTime); }
}

// Create and export singleton instance
export const apiService = new ApiService();

export default apiService;
