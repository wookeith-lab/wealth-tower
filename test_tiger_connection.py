"""
🐯 Wealth Tower — Phase 1 Tiger API Connection Test
=====================================================
Read-only test. Verifies we can connect and pull portfolio data.

NO TRADING FUNCTIONS. By design, only get_* methods are used.
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Import Tiger SDK
try:
    from tigeropen.tiger_open_config import TigerOpenClientConfig
    from tigeropen.common.consts import Language, Market
    from tigeropen.trade.trade_client import TradeClient
    from tigeropen.quote.quote_client import QuoteClient
except ImportError as e:
    print(f"❌ Tiger SDK import failed: {e}")
    sys.exit(1)


def banner(text):
    """Pretty section divider."""
    print("\n" + "━" * 60)
    print(f"  {text}")
    print("━" * 60)


def main():
    print("\n🐯 Wealth Tower — Tiger API Connection Test")
    print("=" * 60)
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # ========================================================
    # Step 1: Load configuration
    # ========================================================
    banner("STEP 1: Loading configuration")
    
    config_path = os.getenv("TIGER_CONFIG_PATH")
    account = os.getenv("TIGER_ACCOUNT")
    
    if not config_path or not account:
        print("❌ Missing TIGER_CONFIG_PATH or TIGER_ACCOUNT in .env")
        sys.exit(1)
    
    print(f"   Config path: {config_path}")
    print(f"   Account:     {account}")
    
    # Make sure config_path ends with / for tigeropen
    if not config_path.endswith("/"):
        config_path += "/"
    
    # ========================================================
    # Step 2: Build client config
    # ========================================================
    banner("STEP 2: Authenticating with Tiger")
    
    try:
        client_config = TigerOpenClientConfig(props_path=config_path)
        client_config.language = Language.en_US
        print("   ✅ Config loaded successfully")
    except Exception as e:
        print(f"   ❌ Failed to load config: {e}")
        sys.exit(1)
    
    # ========================================================
    # Step 3: Initialize Trade Client (READ-ONLY usage)
    # ========================================================
    banner("STEP 3: Connecting to Tiger Trade API")
    
    try:
        trade_client = TradeClient(client_config)
        print("   ✅ Trade client initialized")
    except Exception as e:
        print(f"   ❌ Trade client failed: {e}")
        sys.exit(1)
    
    # ========================================================
    # Step 4: Get account info
    # ========================================================
    banner("STEP 4: Fetching account info")
    
    try:
        managed_accounts = trade_client.get_managed_accounts()
        print(f"   ✅ Accounts found: {len(managed_accounts)}")
        for acc in managed_accounts:
            print(f"      - {acc}")
    except Exception as e:
        print(f"   ❌ Failed: {e}")
    
    # ========================================================
    # Step 5: Get portfolio assets
    # ========================================================
    banner("STEP 5: Fetching portfolio assets")
    
    try:
        assets = trade_client.get_assets(account=account)
        print(f"   ✅ Assets retrieved")
        for asset in assets:
            print(f"   {asset}")
    except Exception as e:
        print(f"   ⚠️  Get assets failed: {e}")
    
    # ========================================================
    # Step 6: Get positions
    # ========================================================
    banner("STEP 6: Fetching positions (your holdings)")
    
    try:
        positions = trade_client.get_positions(account=account)
        print(f"   ✅ Found {len(positions)} positions:\n")
        
        if not positions:
            print("   (No positions found)")
        else:
            for i, pos in enumerate(positions, 1):
                print(f"   {i}. {pos}")
    except Exception as e:
        print(f"   ❌ Failed: {e}")
    
    # ========================================================
    # Done
    # ========================================================
    banner("✅ CONNECTION TEST COMPLETE")
    print("\n🎉 Tiger API is working! Ready to build Wealth Tower.\n")


if __name__ == "__main__":
    main()
