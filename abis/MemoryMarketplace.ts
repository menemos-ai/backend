export const MemoryMarketplaceABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "registryAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_ROYALTY_BPS",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint96", "internalType": "uint96" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "activeRentals",
    "inputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" },
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "buy",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "fork",
    "inputs": [
      {
        "name": "parentTokenId",
        "type": "uint256",
        "internalType": "uint256"
      },
      { "name": "contentHash", "type": "bytes32", "internalType": "bytes32" },
      { "name": "storageURI", "type": "string", "internalType": "string" }
    ],
    "outputs": [
      { "name": "childTokenId", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "forkRoyaltyBps",
    "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "uint96", "internalType": "uint96" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getListing",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct MemoryMarketplace.Listing",
        "components": [
          { "name": "seller", "type": "address", "internalType": "address" },
          {
            "name": "buyPrice",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "rentPricePerDay",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "forkPrice",
            "type": "uint256",
            "internalType": "uint256"
          },
          { "name": "royaltyBps", "type": "uint96", "internalType": "uint96" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isCurrentRenter",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "internalType": "uint256" },
      { "name": "renter", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "list",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "internalType": "uint256" },
      { "name": "buyPrice", "type": "uint256", "internalType": "uint256" },
      {
        "name": "rentPricePerDay",
        "type": "uint256",
        "internalType": "uint256"
      },
      { "name": "forkPrice", "type": "uint256", "internalType": "uint256" },
      { "name": "royaltyBps", "type": "uint96", "internalType": "uint96" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "listings",
    "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "outputs": [
      { "name": "seller", "type": "address", "internalType": "address" },
      { "name": "buyPrice", "type": "uint256", "internalType": "uint256" },
      {
        "name": "rentPricePerDay",
        "type": "uint256",
        "internalType": "uint256"
      },
      { "name": "forkPrice", "type": "uint256", "internalType": "uint256" },
      { "name": "royaltyBps", "type": "uint96", "internalType": "uint96" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payRoyalty",
    "inputs": [
      { "name": "childTokenId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "registry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract MemoryRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rent",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "internalType": "uint256" },
      { "name": "durationDays", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "unlist",
    "inputs": [
      { "name": "tokenId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Bought",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "buyer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "seller",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "price",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Forked",
    "inputs": [
      {
        "name": "parentTokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "childTokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "forker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "price",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Listed",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "seller",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "buyPrice",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "rentPricePerDay",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "forkPrice",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "royaltyBps",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Rented",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "renter",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "expiresAt",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "price",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoyaltyPaid",
    "inputs": [
      {
        "name": "childTokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "parentTokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "parentOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Unlisted",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "seller",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  { "type": "error", "name": "ReentrancyGuardReentrantCall", "inputs": [] }
] as const;
