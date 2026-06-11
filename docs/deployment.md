# Wealth Tower Deployment & Operations Guide

## Current Deployment Model

**Environment:** Mac Mini (airmini@Macmini)
**Python:** 3.13.1
**Node:** v20.19.6
**Git:** 2.50.1

## Directory Structure

```
~/Projects/wealth-tower/
├── venv/                          (Python virtual environment)
├── migrations/                    (SQL schema — see recovery-plan.md)
├── sync_tiger_to_supabase.py     (Main sync application)
├── test_tiger_connection.py       (Connectivity test)
├── .env                           (gitignored — contains secrets)
├── .gitignore                     (excludes .env, *.key, etc.)
├── README.md                      (project overview)
└── docs/                          (this folder)
```

## Operating the Sync Pipeline

### Prerequisites

1. **Environment setup:**
   ```bash
   cd ~/Projects/wealth-tower
   source venv/bin/activate
   ```

2. **Credentials in place:**
   - ~/.env file exists with Supabase keys
   - ~/Documents/wealth-tower-secrets/tiger_openapi_config.properties exists

### Manual Sync Execution

```bash
cd ~/Projects/wealth-tower
source venv/bin/activate
python sync_tiger_to_supabase.py
```

**Expected output:**
```
✅ Tiger API synced 6 positions
✅ Portfolio: $2,757.14 USD net liquidation
✅ Portfolio snapshot created
✅ Positions upserted
✅ Sync logged
Sync completed in 886ms
```

### Test Connectivity

```bash
cd ~/Projects/wealth-tower
source venv/bin/activate
python test_tiger_connection.py
```

## Monitoring & Logging

### Sync Logs in Supabase

Query recent syncs:
```sql
SELECT sync_timestamp, status, positions_count, duration_ms
FROM sync_logs
ORDER BY sync_timestamp DESC
LIMIT 10;
```

## Troubleshooting

**Tiger API authentication failed**: Verify tiger_openapi_config.properties exists and RSA key is valid

**Supabase connection timeout**: Check .env credentials and network connectivity

**Portfolio snapshot already exists for today**: Expected if sync runs multiple times daily

## Database Migrations

**Status:** Placeholder files only. Actual schema lives in Supabase.

Before production release, export current Supabase schema to SQL via Supabase CLI.

See docs/recovery-plan.md for full schema export workflow.
