import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { MnemosClient } from '@mnemos-sdk/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

const mnemos = new MnemosClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  chainId: parseInt(process.env.OG_CHAIN_ID ?? '16661', 10),
  rpcUrl: process.env.OG_RPC_URL!,
  storageNodeUrl: process.env.OG_STORAGE_NODE!,
  registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
  marketplaceAddress: process.env.MARKETPLACE_ADDRESS as `0x${string}`,
});

mnemos.autoSnapshot({
  intervalMs: 30_000,
  buildBundle: () => ({
    data: { summary: 'agent memory here' },
    metadata: {
      category: 'trading',
      title: 'Basic Integration Example',
      agentId: 'basic-agent-v1',
      version: '1.0.0',
      createdAt: Date.now(),
      tags: ['example', 'basic'],
    },
  }),
  onSnapshot: (result) => {
    console.log('Minted token', result.tokenId.toString());
    console.log('  txHash:    ', result.txHash);
    console.log('  storageUri:', result.storageUri);
    console.log('  timestamp: ', new Date(result.timestamp).toISOString());
  },
  onError: (err) => console.error('Snapshot failed:', err.message),
});
