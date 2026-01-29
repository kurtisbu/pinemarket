
-- Phase 1: Database Enhancement for Script Assignment System

-- Add tradingview_username to purchases table to store buyer's TradingView username
ALTER TABLE public.purchases 
ADD COLUMN tradingview_username TEXT;

-- Add pine_id to tradingview_scripts table to store TradingView's internal script ID
ALTER TABLE public.tradingview_scripts 
ADD COLUMN pine_id TEXT;

-- Add platform_fee column to purchases table (was missing from the stripe migration)
ALTER TABLE public.purchases 
ADD COLUMN platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add stripe_transfer_id to purchases table for tracking transfers
ALTER TABLE public.purchases 
ADD COLUMN stripe_transfer_id TEXT;

-- Update script_assignments table to include more tracking fields
ALTER TABLE public.script_assignments 
ADD COLUMN pine_id TEXT,
ADD COLUMN tradingview_username TEXT,
ADD COLUMN assignment_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_attempt_at TIMESTAMPTZ,
ADD COLUMN assignment_details JSONB;

-- Create index for better performance on pine_id lookups
CREATE INDEX IF NOT EXISTS idx_tradingview_scripts_pine_id ON public.tradingview_scripts(pine_id);
CREATE INDEX IF NOT EXISTS idx_script_assignments_status ON public.script_assignments(status);
