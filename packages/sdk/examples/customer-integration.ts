import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { MnemosClient } from '@mnemos-sdk/sdk';
import type { MemoryBundle, ListingEvent } from '@mnemos-sdk/sdk';
import { createPublicClient, http, defineChain } from 'viem';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

interface TradeEvent {
  timestamp: number;
  pair: string;
  action: 'buy' | 'sell';
  amount: number;
  price: number;
  pnl: number;
}

interface AgentMemory {
  trades: TradeEvent[];
  totalPnl: number;
  winRate: number;
  snapshotCount: number;
}

const PAIRS = ['ETH/USDC', 'BTC/USDC', 'SOL/USDC', 'ARB/USDC'];

function generateTrade(): TradeEvent {
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const action = Math.random() > 0.5 ? 'buy' : 'sell';
  const amount = Math.round(Math.random() * 1000 * 100) / 100;
  const price = Math.round(Math.random() * 3000 * 100) / 100;
  const pnl = Math.round((Math.random() - 0.45) * 200 * 100) / 100;
  return { timestamp: Date.now(), pair, action, amount, price, pnl };
}

async function main() {
  const chain = defineChain({
    id: parseInt(process.env.OG_CHAIN_ID ?? '16661', 10),
    name: '0G Network',
    nativeCurrency: { name: '0G', symbol: 'A0GI', decimals: 18 },
    rpcUrls: { default: { http: [process.env.OG_RPC_URL!] } },
  });

  const mnemos = new MnemosClient({
    privateKey: process.env.CUSTOMER_PRIVATE_KEY as `0x${string}`,
    chainId: parseInt(process.env.OG_CHAIN_ID ?? '16661', 10),
    rpcUrl: process.env.OG_RPC_URL!,
    storageNodeUrl: process.env.OG_STORAGE_NODE!,
    registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
    marketplaceAddress: process.env.MARKETPLACE_ADDRESS as `0x${string}`,
  });

  const publicClient = createPublicClient({ chain, transport: http(process.env.OG_RPC_URL!) });

  async function waitTx(hash: `0x${string}`) {
    return publicClient.waitForTransactionReceipt({ hash, timeout: 180_000, pollingInterval: 5_000 });
  }

  // 1. Discover token to acquire
  let tokenId: bigint;
  let listing: ListingEvent;

  if (process.env.TARGET_TOKEN_ID) {
    tokenId = BigInt(process.env.TARGET_TOKEN_ID);
    const terms = await mnemos.getListing(tokenId);
    listing = { tokenId, ...terms };
    console.log(`Targeting token #${tokenId} directly`);
  } else {
    console.log('Scanning marketplace listings...');
    const listings = await mnemos.scanListings();
    const available = listings.filter((l) => l.rentPricePerDay > 0n || l.buyPrice > 0n);
    if (available.length === 0) {
      console.error('No available listings found. Exiting.');
      process.exit(1);
    }
    listing = available[0];
    tokenId = listing.tokenId;
    console.log(`Found ${listings.length} listing(s), selecting token #${tokenId}`);
  }

  // 2. Acquire — prefer rent (lower upfront cost), fall back to buy
  const RENT_DAYS = parseInt(process.env.RENT_DAYS ?? '1', 10);
  if (listing.rentPricePerDay > 0n) {
    console.log(`Renting token #${tokenId} for ${RENT_DAYS} day(s)...`);
    const hash = await mnemos.rent(tokenId, RENT_DAYS);
    await waitTx(hash);
    console.log(`Rented ✓  (tx: ${hash})`);
  } else {
    console.log(`Buying token #${tokenId}...`);
    const hash = await mnemos.buy(tokenId);
    await waitTx(hash);
    console.log(`Bought ✓  (tx: ${hash})`);
  }

  // 3. Load inherited memory from 0G Storage (gracefully skip if unreadable)
  console.log('Loading inherited memory from 0G Storage...');
  const inherited = await mnemos.loadMemory(tokenId).catch(() => null);
  const inheritedData = inherited?.data as Partial<AgentMemory> | undefined;

  const memory: AgentMemory = {
    trades: inheritedData?.trades ?? [],
    totalPnl: inheritedData?.totalPnl ?? 0,
    winRate: inheritedData?.winRate ?? 0,
    snapshotCount: inheritedData?.snapshotCount ?? 0,
  };

  if (inherited) {
    console.log(
      `Inherited: ${memory.trades.length} trade(s)` +
        ` | PnL: $${memory.totalPnl.toFixed(2)}` +
        ` | Win rate: ${(memory.winRate * 100).toFixed(1)}%`,
    );
  } else {
    console.log('No readable memory found — starting fresh.');
  }

  console.log('\nCustomer bot starting...');
  console.log(`Parent token: #${tokenId} | Trades every 2s | Snapshot every 30s\n`);

  // 4. Trading loop — accumulate on top of inherited state
  setInterval(() => {
    const trade = generateTrade();
    memory.trades.push(trade);
    memory.totalPnl += trade.pnl;
    memory.winRate = memory.trades.filter((t) => t.pnl > 0).length / memory.trades.length;

    const sign = trade.pnl >= 0 ? '+' : '';
    console.log(
      `[${new Date().toISOString()}] ${trade.action.toUpperCase()} ${trade.pair}` +
        ` | $${trade.amount} @ $${trade.price}` +
        ` | PnL: ${sign}$${trade.pnl.toFixed(2)}` +
        ` | Total: ${sign}$${memory.totalPnl.toFixed(2)}`,
    );
  }, 2000);

  // 5. Snapshot own experience, referencing the inherited parent token
  const stop = mnemos.autoSnapshot({
    intervalMs: 30_000,
    buildBundle: (): MemoryBundle => ({
      data: { ...memory, trades: memory.trades.slice(-100), parentRef: tokenId.toString() },
      metadata: {
        category: 'trading',
        title: 'DeFi Yield Explorer v1 — Customer',
        agentId: 'defi-yield-customer-v1',
        version: '1.0.0',
        createdAt: Date.now(),
        tags: ['defi', 'yield', 'customer', 'inherited'],
      },
    }),
    onSnapshot: (result) => {
      memory.snapshotCount++;
      console.log(`\nSnapshot #${memory.snapshotCount} minted`);
      console.log(`  Token ID:  ${result.tokenId}`);
      console.log(`  Storage:   ${result.storageUri}`);
      console.log(`  Tx:        ${result.txHash}\n`);
    },
    onError: (err) => {
      console.error(`[snapshot error] ${err.message}`);
    },
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    stop();
    console.log(
      `Final summary: ${memory.trades.length} trade(s)` +
        ` | PnL: $${memory.totalPnl.toFixed(2)}` +
        ` | Win rate: ${(memory.winRate * 100).toFixed(1)}%`,
    );
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
