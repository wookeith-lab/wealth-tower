# Wealth Tower Technical Architecture

## System Overview

Tiger Brokers API → Python Sync Service → Supabase PostgreSQL → Investment Journey Dashboard

## Component Architecture

### 1. Tiger Brokers Integration

- **Account**: PRIME 50213686 (production)
- **SDK**: tigeropen 3.5.9
- **Auth**: RSA key-based (~/Documents/wealth-tower-secrets/tiger_openapi_config.properties)
- **Data flow**: Account → Positions → Portfolio snapshot (real-time sync)
- **Latency**: ~886ms per sync cycle

**Tracked entities:**
- Portfolio (account-level liquidation value)
- Positions (individual holdings with market price)
- Portfolio snapshots (historical point-in-time records)

### 2. Supabase Backend

- **Region**: Singapore (ovihgfsycquwptjenjcd.supabase.co)
- **Database**: PostgreSQL
- **Schema tables** (8 total): portfolios, positions, portfolio_snapshots, sync_logs, + 4 additional
- **Auth**: Row-level security (service role + user role)

### 3. Sync Pipeline

**File:** sync_tiger_to_supabase.py

**Process:**
1. Authenticate to Tiger API (RSA key)
2. Fetch current portfolio from Tiger
3. Extract 6 positions (AAPL, BB, COPX, NVDA, TSM, RE4.SI)
4. Create portfolio snapshot in Supabase
5. Upsert positions (insert or update)
6. Log sync event with timestamp & status
7. Return JSON status (success/failure)

### 4. Testing & Verification

**File:** test_tiger_connection.py

Validates:
- Tiger API credential validity
- Network connectivity
- Response parsing
- Error handling

## Data Model

**Portfolios**: id, account_id, net_liquidation, cash_balance, created_at, updated_at

**Positions**: id, portfolio_id, symbol, quantity, market_price, position_value, currency, created_at, updated_at

**Portfolio Snapshots**: id, portfolio_id, snapshot_date, net_liquidation, total_positions, created_at

**Sync Logs**: id, sync_timestamp, status, positions_count, error_message, duration_ms

## Deployment Target

- **Compute**: Python 3.13+ on Mac Mini
- **Environment**: venv at ~/Projects/wealth-tower/venv/
- **Future**: Docker + Cloud Run (planned Phase 5)

## Security Model

**Secrets hierarchy:**
1. Tiger RSA key → Password Manager (primary)
2. Supabase service_role_key → Password Manager (primary)
3. .env file → Local (gitignored, not committed)
4. GitHub secrets → Not yet implemented (future)

**No credentials are stored in GitHub, docs, or version control.**
