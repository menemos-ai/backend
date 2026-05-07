import 'dotenv/config';
import { MnemosClient } from '@mnemos/sdk';
import type { MemoryBundle } from '@mnemos/sdk';

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
  const mnemos = new MnemosClient({
    privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
    rpcUrl: process.env.OG_RPC_URL!,
    storageNodeUrl: process.env.OG_STORAGE_NODE!,
    registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
    marketplaceAddress: process.env.MARKETPLACE_ADDRESS as `0x${string}`,
  });

  const memory: AgentMemory = {
    trades: [],
    totalPnl: 0,
    winRate: 0,
    snapshotCount: 0,
  };

  console.log('DeFi Yield Explorer agent starting...');
  console.log('Trades every 2s | Snapshot every 30s\n');

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

  const stop = mnemos.autoSnapshot({
    intervalMs: 30_000,
    buildBundle: (): MemoryBundle => ({
      data: { ...memory, trades: memory.trades.slice(-100) },
      metadata: {
        category: 'trading',
        agentId: 'defi-yield-explorer-v1',
        version: '1.0.0',
        createdAt: Date.now(),
        tags: ['defi', 'yield', 'automated'],
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
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
