# Apex Zenith Blockchain Anchoring System

This folder contains the Solidity smart contract and deployment files to support tamper-proof clinical records on the **Polygon blockchain**.

## Key architecture overview
To protect patient privacy while ensuring clinical audit integrity, we:
1. **Hash patient records**: compute the SHA-256 hash of patient parameters (age, village, severity) + the original voice transcript locally in the browser.
2. **Anchor on-chain**: send only the `SHA-256 hash`, `ASHA ID` (anonymized), and `Severity Level` (Red/Yellow/Green) to the smart contract.
3. **No private data on-chain**: no patient names, phone numbers, or transcripts are written to the blockchain.

**Current status**: the app computes a real SHA-256 data hash and simulates the anchoring transaction (a locally generated tx hash + block number) so the feature works fully offline without wallet/gas setup. Deploying `TriageAnchor.sol` and wiring a real wallet client (see below) upgrades this from simulated to a live on-chain write — the record shape doesn't change either way.

---

## 1. Local compile & deploy instructions

### Prerequisites
Install Hardhat and dependencies inside this folder:
```bash
npm init -y
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
npx hardhat init
```

### Deploy to Polygon Amoy testnet
Add the network to your `hardhat.config.js`:
```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    polygon_amoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: [process.env.PRIVATE_KEY] // Replace with your wallet private key
    }
  }
};
```
Deploy the contract:
```bash
npx hardhat run deploy.js --network polygon_amoy
```

---

## 2. Frontend client connection snippet (for a real on-chain write)
Once deployed, wiring a real transaction requires adding `ethers` to `frontend/package.json` and a client like:

```javascript
import { ethers } from 'ethers';

const CONTRACT_ABI = [
  "function anchorTriage(bytes32 txHash, bytes32 dataHash, string workerId, string urgency) external",
  "function getAnchor(bytes32 txHash) external view returns (bytes32, uint256, string, string)"
];

const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";

export async function anchorTriageOnChain(txHash, dataHash, workerId, urgency) {
  if (!window.ethereum) throw new Error("No crypto wallet found");

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

  const tx = await contract.anchorTriage(
    ethers.utils.formatBytes32String(txHash),
    ethers.utils.formatBytes32String(dataHash),
    workerId,
    urgency
  );

  const receipt = await tx.wait(1);
  return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
}
```
