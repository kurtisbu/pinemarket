# TradingView Integration Redesign Plan

## Current System Overview

### Edge Functions (supabase/functions/tradingview-service/)
1. **testConnection.ts** - Validates TV credentials using session cookies, extracts username
2. **syncUserScripts.ts** - Scrapes user's published scripts from profile page
3. **assignScriptAccess.ts** - Grants script access via TV API
4. **revokeScriptAccess.ts** - Revokes script access via TV API
5. **disconnectTradingView.ts** - Clears TV connection data

### Current Authentication Method
- Uses encrypted session cookies (`sessionid`, `sessionid_sign`)
- Stored in `profiles` table: `tradingview_session_cookie`, `tradingview_signed_session_cookie`
- Encrypted using AES-GCM with `TRADINGVIEW_ENCRYPTION_KEY`

### Database Tables
- **profiles**: TV connection status, username, encrypted cookies
- **tradingview_scripts**: Synced script data (script_id, pine_id, title, URL, likes, etc.)
- **script_assignments**: Assignment tracking for purchased scripts
- **assignment_logs**: Detailed logs of assignment attempts

### Current Workflow
1. User provides TV session cookies → `testConnection`
2. System validates and stores encrypted cookies
3. User syncs scripts → `syncUserScripts` scrapes profile
4. On purchase → `assignScriptAccess` grants access via TV API
5. On expiry/cancel → `revokeScriptAccess` removes access

## Proposed New System (Using Public API)

### Questions to Answer
1. **API Authentication**: What auth method does the public API use? (API keys, OAuth, tokens?)
2. **Script Discovery**: How to fetch user's published scripts?
3. **Access Management**: How to grant/revoke script access to buyers?
4. **User Connection**: What info needed to connect a user's TV account?
5. **Rate Limits**: What are the API rate limits and how to handle them?

### New Architecture Proposal

#### Phase 1: Core API Integration
- [ ] New edge function: `tradingview-api-service`
- [ ] Replace cookie-based auth with API key/token auth
- [ ] Update `profiles` table schema for new auth method
- [ ] Implement API client wrapper with error handling

#### Phase 2: Script Management
- [ ] Rebuild script sync using API endpoints
- [ ] Update `tradingview_scripts` table if needed
- [ ] Implement incremental sync (only fetch changes)
- [ ] Add script metadata validation

#### Phase 3: Access Control
- [ ] Rebuild assignment logic using API
- [ ] Update assignment status tracking
- [ ] Implement retry logic for failed assignments
- [ ] Add webhook support for real-time status updates (if available)

#### Phase 4: Frontend Updates
- [ ] New connection flow UI (based on new auth method)
- [ ] Update sync UI with better status indicators
- [ ] Improve error messages for API issues
- [ ] Add connection health monitoring dashboard

#### Phase 5: Migration
- [ ] Migration script for existing users
- [ ] Deprecation plan for cookie-based system
- [ ] Testing with existing data
- [ ] Rollback strategy

### Technical Decisions Needed

1. **Data Migration**: Keep or discard existing cookie data?
2. **Backward Compatibility**: Support old system during transition?
3. **Error Handling**: How to handle API downtime or errors?
4. **Caching**: Cache API responses? For how long?
5. **Security**: Where to store API credentials? (Supabase secrets)

### Files to Modify/Create

#### New Files
- `supabase/functions/tradingview-api-service/index.ts`
- `supabase/functions/tradingview-api-service/client.ts` (API wrapper)
- `supabase/functions/tradingview-api-service/actions/connectAccount.ts`
- `supabase/functions/tradingview-api-service/actions/syncScripts.ts`
- `supabase/functions/tradingview-api-service/actions/manageAccess.ts`
- `src/components/TradingViewApiConnection.tsx` (new connection UI)

#### Modified Files
- Database migration for schema changes
- `src/components/SellerOnboarding.tsx` (new connection flow)
- `src/components/UserTradingViewScripts.tsx` (use new API)
- All assignment-related components

### Security Considerations
- Store API credentials securely in Supabase secrets
- Validate all API responses
- Rate limit protection
- Audit logging for all TV operations
- User consent for data access

### Testing Strategy
1. Test API connectivity and auth
2. Test script fetching with various account types
3. Test access grant/revoke flows
4. Test error handling and retries
5. Load testing for concurrent operations
6. Security testing for credential storage

## Next Steps
1. User provides public API documentation/details
2. Finalize authentication approach
3. Create detailed technical specification
4. Begin implementation in phases
5. Test thoroughly before migration
