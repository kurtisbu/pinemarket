

# Deep Clean and Refactor Plan

## Overview

A comprehensive cleanup removing 20 unused files, fixing dead imports, and deleting stale documentation. This covers orphaned components, dead hook chains, and outdated markdown files.

## Files to Delete (20 files)

### Unused Components (14 files)

| File | Why it's unused |
|------|----------------|
| `src/components/SecureFileUpload.tsx` | Never imported anywhere |
| `src/components/SecureScriptDownload.tsx` | Never imported anywhere |
| `src/components/SupabaseDiagnostics.tsx` | Never imported anywhere |
| `src/components/AdminSecurityDashboard.tsx` | Never imported (SecurityAuditDashboard is used instead) |
| `src/components/SubscriptionPlanSelector.tsx` | Never imported anywhere |
| `src/components/PurchaseCard.tsx` | Never imported anywhere |
| `src/components/AssignmentManager.tsx` | Never imported anywhere |
| `src/components/AssignmentLogs.tsx` | Never imported anywhere |
| `src/components/AdminPayoutManagement.tsx` | Imported in AdminDashboard but never rendered (AdminPayoutDashboard is used instead) |
| `src/components/SecurePaymentCard.tsx` | Only used by PurchaseCard (which is unused) |
| `src/components/RateLimitStatus.tsx` | Only used by SecurePaymentCard (which is unused) |
| `src/components/RateLimitGuard.tsx` | Only used by SecurePaymentCard (which is unused) |
| `src/components/SellerTradingViewIntegration.tsx` | Never imported anywhere |
| `src/components/PackageCard.tsx` | Never imported anywhere |

### Unused Hooks (4 files)

| File | Why it's unused |
|------|----------------|
| `src/hooks/useEnhancedRateLimit.ts` | Never imported anywhere |
| `src/hooks/usePaymentSecurity.ts` | Only used by SecurePaymentCard (dead chain) |
| `src/hooks/useRateLimitedAction.ts` | Only used by SecurePaymentCard (dead chain) |
| `src/hooks/useRateLimit.ts` | All consumers are being deleted (RateLimitGuard, RateLimitStatus, AdminSecurityDashboard, useRateLimitedAction) |

### Stale Documentation (4 files)

| File | Description |
|------|-------------|
| `MIGRATION_PLAN.md` | Old migration planning doc, no longer needed |
| `STRIPE_CONNECT_FLOW.md` | Stripe flow docs, already implemented |
| `TESTING_GUIDE.md` | Outdated testing guide |
| `TRADINGVIEW_REDESIGN_PLAN.md` | TradingView redesign plan, already implemented |

**Note:** Some files are part of "dead chains" -- for example, `SecurePaymentCard` is only used by `PurchaseCard` (itself unused), which means `SecurePaymentCard` and everything it exclusively depends on (`usePaymentSecurity`, `useRateLimitedAction`, `RateLimitStatus`, `RateLimitGuard`, `useRateLimit`) are all dead code.

## Files to Edit (1 file)

### `src/pages/AdminDashboard.tsx`

Remove two dead imports:
- `import { AdminPayoutManagement } from '@/components/AdminPayoutManagement'` (imported but never rendered)
- `FileText` from the lucide-react icon import (imported but never used)

## What's NOT Being Removed

These hooks are used by `useSellScriptForm` (which is actively used by the SellScript page) and will be kept:
- `src/hooks/useSecurityAudit.ts` -- used by `useSecurityValidation` and `useSecureFileValidation`
- `src/hooks/useSecurityValidation.ts` -- used by `useSellScriptForm`
- `src/hooks/useSecureFileValidation.ts` -- used by `useSellScriptForm`

The `SecurityAuditDashboard` component (in the admin panel Security tab) is also actively used and will be kept.

## Technical Notes

- No database or edge function changes are needed
- No route changes needed (none of the deleted components have routes)
- The `AdminDashboard.tsx` edit is a two-line import cleanup only; no functional changes
- Total: 20 files deleted, 1 file edited (2 import lines removed)
