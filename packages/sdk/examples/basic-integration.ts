import { MnemosClient } from '@mnemos/sdk';

const mnemos = new MnemosClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  rpcUrl: process.env.OG_RPC_URL!,
  storageNodeUrl: process.env.OG_STORAGE_NODE!,
  registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
  marketplaceAddress: process.env.MARKETPLACE_ADDRESS as `0x${string}`,
});

mnemos.autoSnapshot({
  intervalMs: 24 * 60 * 60 * 1000, // daily
  buildBundle: () => ({
    data: { summary: 'agent memory here' },
    metadata: { category: 'trading' },
  }),
  onSnapshot: (result) => console.log('Minted token', result.tokenId, result.txHash),
  onError: (err) => console.error('Snapshot failed:', err.message),
});
