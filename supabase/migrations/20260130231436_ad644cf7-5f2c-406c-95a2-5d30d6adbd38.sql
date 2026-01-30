-- Create junction table for program-script relationships
CREATE TABLE program_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  tradingview_script_id UUID NOT NULL REFERENCES tradingview_scripts(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, tradingview_script_id)
);

-- Enable RLS
ALTER TABLE program_scripts ENABLE ROW LEVEL SECURITY;

-- Sellers can manage scripts for their own programs
CREATE POLICY "Sellers can manage their program scripts"
  ON program_scripts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM programs 
    WHERE programs.id = program_scripts.program_id 
    AND programs.seller_id = auth.uid()
  ));

-- Everyone can view scripts for published programs
CREATE POLICY "Everyone can view scripts for published programs"
  ON program_scripts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM programs 
    WHERE programs.id = program_scripts.program_id 
    AND programs.status = 'published'
  ));

-- Migrate existing programs that have a tradingview_script_id
-- This links existing programs to their scripts in the new junction table
INSERT INTO program_scripts (program_id, tradingview_script_id, display_order)
SELECT 
  p.id,
  ts.id,
  0
FROM programs p
JOIN tradingview_scripts ts ON ts.pine_id = p.tradingview_script_id
WHERE p.tradingview_script_id IS NOT NULL
ON CONFLICT DO NOTHING;