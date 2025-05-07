import { createRpc } from "@lightprotocol/stateless.js";
import { Keypair, PublicKey } from "@solana/web3.js";
import "dotenv/config";
import { readFileSync } from "fs";
import { homedir } from "os";

// Load payer keypair from CLI wallet
const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(readFileSync(homedir() + "/.config/solana/id.json", "utf-8"))
  )
);

// Load RPC endpoint from .env
const rpcEndpoint = process.env.DEVNET_RPC_URL;
if (!rpcEndpoint) throw new Error("DEVNET_RPC_URL not set in .env");

// Create Light Protocol RPC client
const rpc = createRpc(rpcEndpoint, rpcEndpoint, rpcEndpoint);

(async () => {
  const cAccounts = await rpc.getCompressedTokenAccountsByOwner(payer.publicKey);

  console.log(`Compressed token accounts for ${payer.publicKey.toBase58()}:`);

  for (const item of cAccounts.items) {
    const { mint, owner, amount } = item.parsed;
  
    console.log(`Token:   ${mint.toBase58()}`);
    console.log(`  Owner:  ${owner.toBase58()}`);
    console.log(`  Amount: ${amount.toString()}`);
    console.log(""); // empty line for spacing
  }
  
})();
