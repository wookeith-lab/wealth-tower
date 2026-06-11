# Wealth Tower Recovery Plan

**Governance:** See Notion (PC#25 Continuity Operationalization v1.0) for complete disaster recovery doctrine.

## 1. Mac Mini Device Recovery

**Scenario:** Mac Mini fails or is replaced.

**Recovery steps:**

1. Install Python 3.13+ & Node v20+
   ```bash
   brew install python@3.13 node@20
   ```

2. Clone repository
   ```bash
   cd ~/Projects
   git clone https://github.com/wookeith-lab/wealth-tower.git
   cd wealth-tower
   ```

3. Create Python venv
   ```bash
   python3.13 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. Restore secrets
   - Copy tiger_openapi_config.properties to ~/Documents/wealth-tower-secrets/
   - Create .env file with Supabase credentials (from Password Manager)

5. Verify connectivity
   ```bash
   python test_tiger_connection.py
   python sync_tiger_to_supabase.py
   ```

**Recovery time:** ~15 minutes

## 2. Supabase Database Recovery

**Scenario:** Accidental data deletion or schema corruption.

**Recovery steps:**

1. Restore from Supabase backup (automatic daily backups)
   - Log in to Supabase dashboard
   - Navigate to Backups → Restore
   - Select date to restore from
   - Confirm restore

2. Verify data integrity
   ```sql
   SELECT COUNT(*) FROM portfolios;
   SELECT COUNT(*) FROM positions;
   SELECT COUNT(*) FROM portfolio_snapshots;
   ```

3. Resume sync pipeline
   ```bash
   python sync_tiger_to_supabase.py
   ```

**Recovery time:** ~30 minutes (depends on backup availability)

## 3. GitHub Repository Recovery

**Scenario:** Local repository corrupted or deleted.

**Recovery steps:**

1. Clone fresh copy
   ```bash
   cd ~/Projects
   rm -rf wealth-tower
   git clone https://github.com/wookeith-lab/wealth-tower.git
   ```

2. Verify all commits & tags
   ```bash
   git log --oneline -10
   git tag -l
   ```

**Recovery time:** ~2 minutes

## 4. Schema Export & Import

**Export current Supabase schema:**
```bash
supabase db pull --project-id nvwfcjugeqrfftzkxgcm > migrations/schema-snapshot.sql
git add migrations/schema-snapshot.sql
git commit -m "docs: export current schema from Supabase"
git push
```

**Import to new Supabase project:**
```bash
supabase db push --project-id <new-project-id> < migrations/schema-snapshot.sql
```

## 5. Runbook Checklist

**Weekly system health check:**
- [ ] Run python sync_tiger_to_supabase.py manually
- [ ] Verify sync logs in Supabase
- [ ] Check Supabase backup status (daily backup exists)
- [ ] Verify GitHub remote is reachable

**Monthly:**
- [ ] Review sync_logs for errors
- [ ] Confirm Tiger account still has active positions

**Quarterly:**
- [ ] Rotate Tiger API key
- [ ] Rotate Supabase credentials
- [ ] Export schema snapshot to GitHub
