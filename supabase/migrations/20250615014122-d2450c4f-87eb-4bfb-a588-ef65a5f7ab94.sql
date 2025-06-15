
-- Phase 3: Prepare database for script validation

-- Step 1: Create a new ENUM type for program validation status
CREATE TYPE public.program_validation_status AS ENUM ('pending', 'validated', 'failed_validation');

-- Step 2: Add columns to the 'programs' table for TradingView script data and validation
ALTER TABLE public.programs
ADD COLUMN tradingview_publication_url TEXT,
ADD COLUMN tradingview_script_id TEXT,
ADD COLUMN validation_status public.program_validation_status NOT NULL DEFAULT 'pending',
ADD COLUMN last_validated_at TIMESTAMPTZ,
ADD COLUMN validation_error_message TEXT;
