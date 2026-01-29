
-- Create assignment_logs table for comprehensive logging
CREATE TABLE public.assignment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.script_assignments(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_assignment_logs_assignment_id ON public.assignment_logs(assignment_id);
CREATE INDEX idx_assignment_logs_purchase_id ON public.assignment_logs(purchase_id);
CREATE INDEX idx_assignment_logs_created_at ON public.assignment_logs(created_at DESC);
CREATE INDEX idx_assignment_logs_log_level ON public.assignment_logs(log_level);

-- Enable RLS
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Sellers can view logs for their assignments" 
  ON public.assignment_logs 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.script_assignments sa 
      WHERE sa.id = assignment_logs.assignment_id 
      AND sa.seller_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.purchases p 
      WHERE p.id = assignment_logs.purchase_id 
      AND p.seller_id = auth.uid()
    )
  );

-- Admin policy for viewing all logs
CREATE POLICY "Admins can view all logs" 
  ON public.assignment_logs 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Service role can insert logs
CREATE POLICY "Service can insert logs" 
  ON public.assignment_logs 
  FOR INSERT 
  WITH CHECK (true);
