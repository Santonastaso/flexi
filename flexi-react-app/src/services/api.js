import { supabase, handleSupabaseError } from './supabase/client';
import { handleApiError, AppError, ERROR_TYPES } from '../utils/errorHandling';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { AppConfig } from './config';

class ApiService {
  async init() {
    try {
      const { error } = await supabase
        .from('machines')
        .select('count')
        .limit(1);
        
      if (error) {
        throw new AppError(`API initialization failed: ${error.message}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.init' });
      }
      
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`API initialization failed: ${error.message}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.init' });
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
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch machines: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getMachines' });
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
      throw new AppError(`Failed to add machine: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.addMachine' });
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
      throw new AppError(`Failed to update machine: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.updateMachine' });
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
      throw new AppError(`Failed to remove machine: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.removeMachine' });
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
      throw new AppError(`Failed to fetch ODP orders: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getOdpOrders' });
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
      throw new AppError(`Failed to fetch ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getOdpOrder' });
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
      throw new AppError(`Failed to add ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.addOdpOrder' });
    }
  }

  async updateOdpOrder(id, updates) {
    try {
      const { time_remaining, ...safeUpdates } = updates || {};
      const { data, error } = await supabase
        .from('odp_orders')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      throw new AppError(`Failed to update ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.updateOdpOrder' });
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
      throw new AppError(`Failed to remove ODP order: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.removeOdpOrder' });
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
      throw new AppError(`Failed to fetch phases: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getPhases' });
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
      throw new AppError(`Failed to add phase: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.addPhase' });
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
      throw new AppError(`Failed to update phase: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.updatePhase' });
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
      throw new AppError(`Failed to remove phase: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.removePhase' });
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
      throw new AppError(`Failed to fetch machine availability for date range: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getMachineAvailabilityForDateRange' });
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
      throw new AppError(`Failed to fetch machine availability: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getMachineAvailabilityForDate' });
    }
  }

  async getMachineAvailability(machineId, dateStr) {
    const data = await this.getMachineAvailabilityForDate(machineId, dateStr);
    return data?.unavailable_hours || [];
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
      throw new AppError(`Failed to set machine availability: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.setMachineAvailability' });
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
      throw new AppError(`Failed to fetch machine availability for all machines: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getMachineAvailabilityForDateAllMachines' });
    }
  }

  async setUnavailableHoursForRange(machineId, startDate, endDate, startTime, endTime) {
    try {
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      const hoursToMark = [];
      for (let hour = startHour; hour < endHour; hour++) {
        hoursToMark.push(hour.toString());
      }
      
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      let currentDate = new Date(startDateObj);
      const results = [];
      
      while (currentDate <= endDateObj) {
        const dateStr = formatInTimeZone(currentDate, 'Europe/Rome', 'yyyy-MM-dd');
        
        const currentData = await this.getMachineAvailabilityForDate(machineId, dateStr);
        const currentUnavailableHours = currentData?.unavailable_hours || [];
        
        const newUnavailableHours = [...new Set([...currentUnavailableHours, ...hoursToMark])].sort((a, b) => parseInt(a) - parseInt(b));
        
        const result = await this.setMachineAvailability(machineId, dateStr, newUnavailableHours);
        results.push(result);
        
        currentDate = addDays(currentDate, 1);
      }
      
      return results;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to set unavailable hours for range: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.setUnavailableHoursForRange' });
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
      throw new AppError(`Failed to bulk set machine availability: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.bulkUpsertMachineAvailability' });
    }
  }

  // ===== SITE EFFICIENCY =====

  async getSiteEfficiency() {
    try {
      const { data, error } = await supabase
        .from('site_efficiency')
        .select('work_center, efficiency');
      if (error) throw error;
      const map = {};
      for (const row of (data || [])) map[row.work_center] = Number(row.efficiency);
      return map;
    } catch (error) {
      throw new AppError(`Failed to fetch site efficiency: ${handleSupabaseError(error)}`, ERROR_TYPES.SERVER_ERROR, 500, { originalError: error, source: 'API.getSiteEfficiency' });
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

export const apiService = new ApiService();

export default apiService;
