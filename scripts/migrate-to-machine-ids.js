/**
 * Migration Script: Convert scheduled_machine to scheduled_machine_id
 * This makes the system leaner by using machine IDs instead of names
 */

import { createClient } from '@supabase/supabase-js';

// You'll need to add your Supabase credentials here
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateToMachineIds() {
    try {
        console.log('🚀 Starting migration to machine IDs...');
        
        // Step 1: Add the new column
        console.log('📝 Adding scheduled_machine_id column...');
        const { error: alterError } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE odp_orders 
                ADD COLUMN IF NOT EXISTS scheduled_machine_id UUID REFERENCES machines(id);
            `
        });
        
        if (alterError) {
            console.error('Error adding column:', alterError);
            return;
        }
        
        console.log('✅ Column added successfully');
        
        // Step 2: Get all ODP orders with scheduled_machine
        console.log('🔍 Finding ODP orders with scheduled machines...');
        const { data: odpOrders, error: fetchError } = await supabase
            .from('odp_orders')
            .select('id, scheduled_machine')
            .not('scheduled_machine', 'is', null);
            
        if (fetchError) {
            console.error('Error fetching ODP orders:', fetchError);
            return;
        }
        
        console.log(`📊 Found ${odpOrders.length} ODP orders to migrate`);
        
        // Step 3: Get all machines for name-to-ID mapping
        const { data: machines, error: machinesError } = await supabase
            .from('machines')
            .select('id, machine_name');
            
        if (machinesError) {
            console.error('Error fetching machines:', machinesError);
            return;
        }
        
        const machineNameToId = {};
        machines.forEach(machine => {
            machineNameToId[machine.machine_name] = machine.id;
        });
        
        console.log(`🏭 Found ${machines.length} machines for mapping`);
        
        // Step 4: Update each ODP order
        let updatedCount = 0;
        for (const odp of odpOrders) {
            const machineId = machineNameToId[odp.scheduled_machine];
            
            if (machineId) {
                const { error: updateError } = await supabase
                    .from('odp_orders')
                    .update({ 
                        scheduled_machine_id: machineId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', odp.id);
                    
                if (updateError) {
                    console.error(`❌ Error updating ODP ${odp.id}:`, updateError);
                } else {
                    updatedCount++;
                    console.log(`✅ Updated ODP ${odp.id}: ${odp.scheduled_machine} → ${machineId}`);
                }
            } else {
                console.warn(`⚠️  Machine not found: ${odp.scheduled_machine} for ODP ${odp.id}`);
            }
        }
        
        console.log(`🎉 Migration completed! Updated ${updatedCount} ODP orders`);
        
        // Step 5: Verify the migration
        console.log('🔍 Verifying migration...');
        const { data: verifyData, error: verifyError } = await supabase
            .from('odp_orders')
            .select('id, scheduled_machine, scheduled_machine_id')
            .not('scheduled_machine_id', 'is', null);
            
        if (verifyError) {
            console.error('Error verifying migration:', verifyError);
        } else {
            console.log(`✅ Verification: ${verifyData.length} ODP orders have machine IDs`);
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

// Run the migration
migrateToMachineIds();
