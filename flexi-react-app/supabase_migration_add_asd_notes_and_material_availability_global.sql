-- Migration: Add ASD_notes and material_availability_global columns
-- This script adds the new columns to both orders_master_dump and odp_orders tables
-- and updates the sync function to handle the new fields

-- 1. Add columns to orders_master_dump table
ALTER TABLE public.orders_master_dump 
ADD COLUMN IF NOT EXISTS asd_notes text null,
ADD COLUMN IF NOT EXISTS material_availability_global integer null;

-- 2. Add columns to odp_orders table
ALTER TABLE public.odp_orders 
ADD COLUMN IF NOT EXISTS asd_notes text null,
ADD COLUMN IF NOT EXISTS material_availability_global integer null;

-- 3. Update the sync function to include the new columns
CREATE OR REPLACE FUNCTION sync_orders_from_master_dump()
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.odp_orders (
        odp_number, article_code, production_lot, work_center, nome_cliente,
        delivery_date, bag_height, bag_width, bag_step,
        seal_sides, product_type, quantity, internal_customer_code,
        external_customer_code, customer_order_ref, department,
        quantity_completed, material_availability_isp, material_availability_lotti,
        asd_notes, material_availability_global
    )
    SELECT
        dump.odp_number,
        COALESCE(dump.article_code, 'N/A'),
        dump.production_lot,
        COALESCE(dump.work_center, 'ZANICA'),
        COALESCE(dump.nome_cliente, 'UNKNOWN'),
        -- ## THIS IS THE FIX ##
        -- Check for the invalid date before trying to cast it.
        CASE
            WHEN dump.delivery_date IS NULL OR dump.delivery_date = '0000-00-00'
            THEN NOW()
            ELSE dump.delivery_date::TIMESTAMPTZ
        END,
        dump.bag_height,
        dump.bag_width,
        dump.bag_step,
        CASE
            WHEN dump.seal_sides IN (3, 4) THEN dump.seal_sides
            ELSE NULL
        END,
        dump.product_type,
        COALESCE(dump.quantity, 0),
        dump.internal_customer_code,
        dump.external_customer_code,
        COALESCE(dump.customer_order_ref, 'N/A'),
        COALESCE(dump.department, 'STAMPA'),
        COALESCE(dump.quantity_completed, 0),
        dump.material_availability_isp,
        dump.material_availability_lotti,
        dump.asd_notes,
        dump.material_availability_global
    FROM
        public.orders_master_dump AS dump
    WHERE
        dump.odp_number IS NOT NULL AND dump.odp_number <> ''

    ON CONFLICT (odp_number)
    DO UPDATE SET
        quantity_completed = EXCLUDED.quantity_completed,
        material_availability_isp = EXCLUDED.material_availability_isp,
        material_availability_lotti = EXCLUDED.material_availability_lotti,
        asd_notes = EXCLUDED.asd_notes,
        material_availability_global = EXCLUDED.material_availability_global,
        updated_at = NOW()
    WHERE
        odp_orders.quantity_completed IS DISTINCT FROM EXCLUDED.quantity_completed
        OR odp_orders.material_availability_isp IS DISTINCT FROM EXCLUDED.material_availability_isp
        OR odp_orders.material_availability_lotti IS DISTINCT FROM EXCLUDED.material_availability_lotti
        OR odp_orders.asd_notes IS DISTINCT FROM EXCLUDED.asd_notes
        OR odp_orders.material_availability_global IS DISTINCT FROM EXCLUDED.material_availability_global;

END;
$$ LANGUAGE plpgsql;

-- Remember to re-apply permissions
ALTER FUNCTION sync_orders_from_master_dump() SET search_path = public;
ALTER FUNCTION sync_orders_from_master_dump() OWNER TO postgres;
ALTER FUNCTION sync_orders_from_master_dump() SECURITY DEFINER;
