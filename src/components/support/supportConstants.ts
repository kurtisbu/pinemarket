export const CATEGORY_LABEL: Record<string, string> = {
  billing: 'Billing & Payments',
  tradingview_access: 'TradingView Access',
  bug_report: 'Bug Report',
  account: 'Account',
  feature_request: 'Feature Request',
  other: 'Other',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_user: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default',
  in_progress: 'default',
  waiting_user: 'secondary',
  resolved: 'outline',
  closed: 'outline',
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};