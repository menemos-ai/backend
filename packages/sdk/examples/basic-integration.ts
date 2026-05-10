import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { MnemosClient } from '@mnemos-sdk/sdk';
import { createPublicClient, createWalletClient, http, parseEther, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

const chain = defineChain({
  id: parseInt(process.env.OG_CHAIN_ID ?? '16661', 10),
  name: '0G Network',
  nativeCurrency: { name: '0G', symbol: 'A0GI', decimals: 18 },
  rpcUrls: { default: { http: [process.env.OG_RPC_URL!] } },
});

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain, transport: http(process.env.OG_RPC_URL!) });
const walletClient = createWalletClient({ account, chain, transport: http(process.env.OG_RPC_URL!) });

const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS as `0x${string}`;
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS as `0x${string}`;

const REGISTRY_ABI = [
  { name: 'setApprovalForAll', type: 'function', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'isApprovedForAll', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
] as const;

const MARKETPLACE_ABI = [
  { name: 'list', type: 'function', inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'buyPrice', type: 'uint256' }, { name: 'rentPricePerDay', type: 'uint256' }, { name: 'forkPrice', type: 'uint256' }, { name: 'royaltyBps', type: 'uint96' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

async function waitReceipt(hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({
    hash,
    timeout: 180_000,
    pollingInterval: 5_000,
  });
}

async function ensureApproval() {
  const approved = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'isApprovedForAll',
    args: [account.address, MARKETPLACE_ADDRESS],
  });
  if (!approved) {
    console.log('Approving marketplace...');
    const hash = await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setApprovalForAll',
      args: [MARKETPLACE_ADDRESS, true],
    });
    await waitReceipt(hash);
    console.log('Marketplace approved ✓');
  }
}

async function listToken(tokenId: bigint) {
  const hash = await walletClient.writeContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: 'list',
    args: [
      tokenId,
      parseEther('0.01'),  // buyPrice
      parseEther('0.001'), // rentPricePerDay
      parseEther('0.005'), // forkPrice
      500n,                // royaltyBps (5%)
    ],
  });
  await waitReceipt(hash);
  console.log(`  listed ✓ (buy: 0.01 A0GI, rent: 0.001/day, fork: 0.005)`);
}

const mnemos = new MnemosClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  chainId: parseInt(process.env.OG_CHAIN_ID ?? '16661', 10),
  rpcUrl: process.env.OG_RPC_URL!,
  storageNodeUrl: process.env.OG_STORAGE_NODE!,
  registryAddress: REGISTRY_ADDRESS,
  marketplaceAddress: MARKETPLACE_ADDRESS,
});

await ensureApproval();

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
    listToken(result.tokenId).catch((err) =>
      console.error('List failed:', err.message),
    );
  },
  onError: (err) => console.error('Snapshot failed:', err.message),
});
