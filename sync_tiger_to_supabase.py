"""
🐯 → 🏰 Wealth Tower — Tiger to Supabase Sync Service
=====================================================
Read-only sync from Tiger Brokers API to Supabase database.

NO trading functions. Only get_* methods used.
Safe to run multiple times (idempotent UPSERTs).
"""

import os
import sys
from datetime import datetime, date, timezone
from dotenv import load_dotenv

load_dotenv()

# Tiger SDK
from tigeropen.tiger_open_config import TigerOpenClientConfig
from tigeropen.common.consts import Language
from tigeropen.trade.trade_client import TradeClient

# Supabase
from supabase import create_client, Client


def banner(text):
    print("\n" + "━" * 60)
    print(f"  {text}")
    print("━" * 60)


def safe_float(value, default=None):
    """Convert to float, handling inf, NaN, and None safely."""
    if value is None:
        return default
    try:
        f = float(value)
        # Handle NaN and infinity (which Postgres can't store as NUMERIC)
        if f != f or f == float('inf') or f == float('-inf'):
            return default
        return f
    except (ValueError, TypeError):
        return default


def extract_exchange(contract_str):
    """Extract exchange code from Tiger contract symbol."""
    if '.SI' in contract_str:
        return 'SI'  # Singapore
    elif '.HK' in contract_str:
        return 'HK'  # Hong Kong
    elif '.L' in contract_str:
        return 'L'   # London
    else:
        return 'US'  # Default to US


def init_tiger():
    """Initialize Tiger trade client."""
    config_path = os.getenv("TIGER_CONFIG_PATH")
    if not config_path:
        raise ValueError("Missing TIGER_CONFIG_PATH in .env")
    if not config_path.endswith("/"):
        config_path += "/"
    client_config = TigerOpenClientConfig(props_path=config_path)
    client_config.language = Language.en_US
    return TradeClient(client_config)


def init_supabase() -> Client:
    """Initialize Supabase client with service role."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
    return create_client(url, key)


def now_iso():
    """Current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def log_sync(supabase: Client, sync_type: str, status: str, **kwargs):
    """Log a sync operation to sync_logs table."""
    try:
        log_data = {
            'sync_type': sync_type,
            'status': status,
            **kwargs
        }
        supabase.table('sync_logs').insert(log_data).execute()
    except Exception as e:
        print(f"   ⚠️  Could not log sync: {e}")


def sync_portfolio(supabase: Client, trade_client: TradeClient, account: str):
    """Sync portfolio summary for an account. Returns the portfolio data."""
    banner(f"📊 STEP 1: Sync portfolio summary [{account}]")
    
    assets = trade_client.get_assets(account=account)
    if not assets:
        print("   ⚠️  No assets returned from Tiger")
        return None
    
    portfolio = assets[0]
    summary = portfolio.summary
    
    data = {
        'account_id': account,
        'net_liquidation': safe_float(summary.net_liquidation),
        'cash_balance': safe_float(summary.cash),
        'buying_power': safe_float(summary.buying_power),
        'available_funds': safe_float(summary.available_funds),
        'excess_liquidity': safe_float(summary.excess_liquidity),
        'unrealized_pnl': safe_float(summary.unrealized_pnl),
        'realized_pnl': safe_float(summary.realized_pnl),
        'gross_position_value': safe_float(summary.gross_position_value),
        'currency': summary.currency or 'USD',
        'fetched_at': now_iso(),
    }
    
    supabase.table('portfolios').insert(data).execute()
    
    nl = data['net_liquidation'] or 0
    pnl = data['unrealized_pnl'] or 0
    print(f"   ✅ Net Liquidation: ${nl:,.2f} {data['currency']}")
    print(f"   ✅ Unrealized P&L: ${pnl:+,.2f}")
    print(f"   ✅ Cash Balance: ${data['cash_balance'] or 0:,.2f}")
    
    return data


def sync_positions(supabase: Client, trade_client: TradeClient, account: str):
    """Sync positions (holdings) for an account. Returns count."""
    banner(f"💼 STEP 2: Sync positions [{account}]")
    
    positions = trade_client.get_positions(account=account)
    if not positions:
        print("   (No positions found)")
        return 0
    
    count = 0
    for pos in positions:
        contract_str = str(pos.contract)
        parts = contract_str.split('/')
        full_symbol = parts[0] if len(parts) > 0 else 'UNKNOWN'
        sec_type = parts[1] if len(parts) > 1 else 'STK'
        currency = parts[2] if len(parts) > 2 else 'USD'
        exchange = extract_exchange(contract_str)
        
        # Clean symbol (RE4.SI → RE4)
        clean_symbol = full_symbol.replace('.SI', '').replace('.HK', '').replace('.L', '')
        
        data = {
            'account_id': account,
            'symbol': clean_symbol,
            'exchange': exchange,
            'sec_type': sec_type,
            'currency': currency,
            'quantity': safe_float(pos.quantity, 0),
            'salable_qty': safe_float(getattr(pos, 'salable_qty', None)),
            'average_cost': safe_float(pos.average_cost),
            'market_price': safe_float(pos.market_price),
            'market_value': safe_float(pos.market_value),
            'last_close_price': safe_float(getattr(pos, 'last_close_price', None)),
            'unrealized_pnl': safe_float(pos.unrealized_pnl),
            'unrealized_pnl_percent': safe_float(getattr(pos, 'unrealized_pnl_percent', None)),
            'realized_pnl': safe_float(getattr(pos, 'realized_pnl', None)),
            'today_pnl': safe_float(getattr(pos, 'today_pnl', None)),
            'today_pnl_percent': safe_float(getattr(pos, 'today_pnl_percent', None)),
            'fetched_at': now_iso(),
        }
        
        # UPSERT: insert or update if exists (account+symbol+exchange unique)
        supabase.table('positions').upsert(
            data,
            on_conflict='account_id,symbol,exchange'
        ).execute()
        
        # Pretty print
        pnl_val = data['unrealized_pnl'] or 0
        pnl_emoji = "🟢" if pnl_val >= 0 else "🔴"
        qty = data['quantity'] or 0
        price = data['market_price'] or 0
        print(f"   {pnl_emoji} {clean_symbol:6} [{exchange}]  qty: {qty:>6.0f}  @ {price:>8.2f} {currency}  P&L: {pnl_val:>+8.2f}")
        count += 1
    
    print(f"\n   ✅ Synced {count} positions")
    return count


def create_daily_snapshot(supabase: Client, account: str, portfolio_data: dict, position_count: int):
    """Create or update today's snapshot for the account."""
    banner(f"📸 STEP 3: Daily snapshot [{account}]")
    
    if not portfolio_data:
        print("   ⚠️  No portfolio data — skipping snapshot")
        return
    
    today = date.today().isoformat()
    
    data = {
        'account_id': account,
        'snapshot_date': today,
        'net_liquidation': portfolio_data.get('net_liquidation'),
        'cash_balance': portfolio_data.get('cash_balance'),
        'unrealized_pnl': portfolio_data.get('unrealized_pnl'),
        'realized_pnl': portfolio_data.get('realized_pnl'),
        'position_count': position_count,
        'currency': portfolio_data.get('currency'),
    }
    
    # UPSERT — one snapshot per day per account
    supabase.table('portfolio_snapshots').upsert(
        data,
        on_conflict='account_id,snapshot_date'
    ).execute()
    
    print(f"   ✅ Snapshot for {today} saved")


def main():
    print("\n🐯 → 🏰 WEALTH TOWER — Tiger → Supabase Sync")
    print("=" * 60)
    print(f"   Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} SGT")
    
    # Initialize
    banner("INITIALIZING")
    try:
        trade_client = init_tiger()
        print("   ✅ Tiger API connected")
    except Exception as e:
        print(f"   ❌ Tiger init failed: {e}")
        sys.exit(1)
    
    try:
        supabase = init_supabase()
        print("   ✅ Supabase connected")
    except Exception as e:
        print(f"   ❌ Supabase init failed: {e}")
        sys.exit(1)
    
    # Sync
    account = os.getenv("TIGER_ACCOUNT", "50213686")
    start_time = datetime.now(timezone.utc)
    
    log_sync(supabase, 'full_sync', 'started', 
             account_id=account, 
             message=f'Starting full sync for account {account}')
    
    try:
        portfolio_data = sync_portfolio(supabase, trade_client, account)
        position_count = sync_positions(supabase, trade_client, account)
        create_daily_snapshot(supabase, account, portfolio_data, position_count)
        
        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        log_sync(supabase, 'full_sync', 'success', 
                 account_id=account,
                 records_processed=position_count,
                 duration_ms=duration_ms,
                 completed_at=now_iso(),
                 message=f'Successfully synced {position_count} positions')
        
        banner("✅ SYNC COMPLETE")
        print(f"\n🎉 Tiger data is now flowing into Supabase!")
        print(f"   ⏱️  Duration: {duration_ms}ms")
        print(f"   📊 Positions synced: {position_count}")
        print(f"   📸 Snapshot: {date.today()}")
        print(f"\n   🔍 Verify in Supabase Table Editor:")
        print(f"      • portfolios → check newest row")
        print(f"      • positions → should have {position_count} rows")
        print(f"      • portfolio_snapshots → today's snapshot")
        print(f"      • sync_logs → 2 entries (started + success)\n")
        
    except Exception as e:
        duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        log_sync(supabase, 'full_sync', 'failed', 
                 account_id=account,
                 error_detail=str(e),
                 duration_ms=duration_ms,
                 completed_at=now_iso(),
                 message='Sync failed')
        print(f"\n   ❌ Sync failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
