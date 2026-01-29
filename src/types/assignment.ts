
export interface AssignmentLog {
  id: string;
  assignment_id: string;
  purchase_id: string;
  log_level: 'info' | 'warning' | 'error';
  message: string;
  details: any;
  created_at: string;
}

export interface ScriptAssignment {
  id: string;
  purchase_id: string;
  buyer_id: string;
  program_id: string;
  tradingview_script_id: string;
  pine_id: string;
  tradingview_username: string;
  status: 'pending' | 'assigned' | 'failed' | 'expired';
  assignment_attempts: number;
  last_attempt_at: string | null;
  assigned_at: string | null;
  error_message: string | null;
  created_at: string;
  purchases: {
    amount: number;
    programs: {
      title: string;
    };
  };
  profiles: {
    display_name: string;
    username: string;
  };
}
