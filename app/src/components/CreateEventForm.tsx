"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { WebUploader } from "@irys/web-upload";
import { WebSolana } from "@irys/web-upload-solana";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Rpc,
  buildTx,
  createRpc,
  selectStateTreeInfo,
  getCompressedTokenAccounts,
  ParsedTokenAccount,
  bn,
} from "@lightprotocol/stateless.js";
import {
  CompressedTokenProgram,
  getTokenPoolInfos,
  selectTokenPoolInfo,
  selectMinCompressedTokenAccountsForTransfer,
} from "@lightprotocol/compressed-token";
import {
  mintTo as mintToSpl,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  ExtensionType,
  getMintLen,
  LENGTH_SIZE,
  TYPE_SIZE,
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_DEVNET_RPC_URL!;

export default function CreateEventForm() {
  const [mintAddress, setMintAddress] = useState<Keypair | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventImage, setEventImage] = useState<File | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenImage, setTokenImage] = useState<File | null>(null);

  const wallet = useWallet();
  const { publicKey, sendTransaction, signTransaction } = useWallet();

  const uploadToIrys = async (file: File): Promise<string> => {
    if (!wallet) throw new Error("Wallet not connected");
    console.log("test");
    console.log(wallet);
    const irys = await WebUploader(WebSolana).withProvider(wallet);

    console.log("yessss");
    console.log(irys);

    const buffer = await file.arrayBuffer();
    const data = Buffer.from(buffer);

    console.log(data);

    const receipt = await irys?.upload(data, {
      tags: [
        { name: "Content-Type", value: file.type },
        { name: "App-Name", value: "PoP-Event" },
      ],
    });

    console.log(receipt);

    return `https://gateway.irys.xyz/${receipt.id}`;
  };

  const createMint = async (
    connection: Connection,
    mint: PublicKey,
    ata: PublicKey
  ) => {
    if (!publicKey || !signTransaction) {
      throw new Error("Wallet not connected");
    }

    const mintTx = createMintToInstruction(
      mint!,
      ata,
      publicKey,
      1e5,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: publicKey,
    }).add(mintTx);

    const signedTx = await signTransaction(tx);

    const sig = await connection.sendRawTransaction(signedTx.serialize());

    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    });
    console.log(`Minting transaction success! txId: ${sig}`);

    return sig;
  };

  const createATA = async (connection: Connection, mint: PublicKey) => {
    if (!publicKey || !signTransaction) {
      throw new Error("Wallet not connected");
    }

    // 1. Derive associated token address
    const ata = await getAssociatedTokenAddress(
      mint,
      publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Check if the ATA already exists
    const ataExists = await connection.getAccountInfo(ata);

    if (!ataExists) {
      // Create ATA if it doesn't exist
      const ix = createAssociatedTokenAccountInstruction(
        publicKey, // payer
        ata, // associated token account
        publicKey, // owner of the ATA
        mint, // mint address
        TOKEN_2022_PROGRAM_ID // token program ID
      );

      // 3. Build, sign and send transaction
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      const tx = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: publicKey,
      }).add(ix);

      const signedTx = await signTransaction(tx);

      const sig = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      console.log("✅ ATA created:", ata.toBase58());
    }
    return ata;
  };

  const compressMint = async (ata: PublicKey, mint: PublicKey) => {
    const connection = createRpc(RPC_ENDPOINT, RPC_ENDPOINT, RPC_ENDPOINT);

    const infos = await getTokenPoolInfos(connection, mint);
    const tokenPoolInfo = selectTokenPoolInfo(infos);

    console.log(tokenPoolInfo);

    const stateTreeInfo = selectStateTreeInfo(
      await connection.getStateTreeInfos()
    );

    /// compress to self
    const compressInstruction = await CompressedTokenProgram.compress({
      payer: publicKey!,
      toAddress: publicKey!,
      outputStateTreeInfo: stateTreeInfo,
      owner: publicKey!,
      source: ata,
      mint,
      amount: 1e5,
      tokenPoolInfo,
    });

    const compressInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      compressInstruction,
    ];

    const {
      context: { slot: minContextSlot },
      value: blockhashCtx,
    } = await connection.getLatestBlockhashAndContext();

    const tx = buildTx(
      compressInstructions,
      publicKey!,
      blockhashCtx.blockhash
    );

    const signature = await sendTransaction(tx, connection, {
      minContextSlot,
    });

    await connection.confirmTransaction({
      blockhash: blockhashCtx.blockhash,
      lastValidBlockHeight: blockhashCtx.lastValidBlockHeight,
      signature,
    });

    console.log(
      `Compressed txId: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );
  };

  const mintTokens = async (tokenUri: string) => {
    if (!wallet || !wallet.publicKey || !signTransaction) {
      alert("Please connect your wallet.");
      return;
    }

    console.log("sqdfmlkj");
    const payer: PublicKey = wallet.publicKey;
    const connection = new Connection(RPC_ENDPOINT, "confirmed");

    console.log("lbyet");
    const mint = Keypair.generate();
    setMintAddress(mint);

    console.log(mint);
    const decimals = 9;

    const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name: tokenName,
      symbol: tokenSymbol,
      uri: tokenUri,
      additionalMetadata: [],
    };

    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

    const mintLamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataLen
    );
    console.log(mintLamports);

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: mintLamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        payer,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        payer,
        null,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mint.publicKey,
        metadata: mint.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: payer,
        updateAuthority: payer,
      })
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    tx.recentBlockhash = blockhash; // ✅ required
    tx.feePayer = publicKey!; // ✅ required

    tx.partialSign(mint); // ✅ if you're using a mint Keypair

    const signedTx = await signTransaction(tx); // ✅ now safe

    const signature = await connection.sendRawTransaction(signedTx.serialize());

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    console.log("Transaction Create Accounts: ", signature);

    console.log("Creating pool...");
    const poolPda = await createPool(connection, mint.publicKey);

    console.log("Creating ATA...");
    const ata = await createATA(connection, mint.publicKey);

    console.log("Ata:", ata);

    console.log("Creating Mint...");
    await createMint(connection, mint.publicKey, ata);

    console.log("Compressing tokens...");
    await compressMint(ata, mint.publicKey);

    console.log("Transfering compressed token..");
    await transferCompressedTokens(mint.publicKey);
  };

  const transferCompressedTokens = async (mint: PublicKey) => {
    const rpc = createRpc(RPC_ENDPOINT, RPC_ENDPOINT, RPC_ENDPOINT);

    // Get compressed ATA by owner and token mint
    const parsedAccounts = await rpc.getCompressedTokenAccountsByOwner(
      publicKey!,
      { mint: mint }
    );

    if (!parsedAccounts.items.length) {
      throw new Error("No compressed token accounts found for this mint.");
    }

    // select viable accounts that can transfer the minimum amount and most efficient way
    const [inputAccounts, _] = selectMinCompressedTokenAccountsForTransfer(
      parsedAccounts.items,
      1e5
    );


    const { compressedProof, rootIndices } = await rpc.getValidityProofV0(
      inputAccounts.map((account) => ({
        hash: account.compressedAccount.hash,
        tree: account.compressedAccount.treeInfo.tree,
        queue: account.compressedAccount.treeInfo.queue,
      }))
    );

    const transferIx = await CompressedTokenProgram.transfer({
      payer: publicKey!,
      inputCompressedTokenAccounts: inputAccounts,
      toAddress: publicKey!,
      amount: 1e5,
      recentInputStateRootIndices: rootIndices,
      recentValidityProof: compressedProof,
    });

    const transferInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      transferIx,
    ];

    const {
      context: { slot: minContextSlot },
      value: blockhashCtx,
    } = await rpc.getLatestBlockhashAndContext();

    const tx = buildTx(
      transferInstructions,
      publicKey!,
      blockhashCtx.blockhash
    );

    const signature = await sendTransaction(tx, rpc, {
      minContextSlot,
    });

    await rpc.confirmTransaction({
      blockhash: blockhashCtx.blockhash,
      lastValidBlockHeight: blockhashCtx.lastValidBlockHeight,
      signature,
    });

    console.log(
      `Compressed transfer txId: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );

    return signature
  };

  const createPool = async (connection: Connection, mint: PublicKey) => {
    if (!publicKey || !signTransaction) {
      throw new Error("Wallet not connected");
    }

    const createPoolIx = await CompressedTokenProgram.createTokenPool({
      feePayer: publicKey!,
      mint: mint,
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
    });
    const createPoolIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      createPoolIx,
    ];

    const {
      context: { slot: minContextSlot },
      value: blockhashCtx,
    } = await connection.getLatestBlockhashAndContext();

    const tx = buildTx(createPoolIxs, publicKey, blockhashCtx.blockhash);

    const signature = await sendTransaction(tx, connection, {
      minContextSlot,
    });

    await connection.confirmTransaction({
      blockhash: blockhashCtx.blockhash,
      lastValidBlockHeight: blockhashCtx.lastValidBlockHeight,
      signature,
    });

    console.log(
      `Created Pool! txId: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );

    return signature;
  };

  const handleCreateToken = async () => {
    // if (!eventName || !tokenName || !tokenSymbol || !eventDescription) {
    //   alert("Please fill in all required text fields: event name, token name, symbol, and description.");
    //   return;
    // }

    //
    //
    if (!tokenImage) {
      alert("Please upload both an event image and a token image.");
      return;
    }

    //const eventImageUrl = await uploadToIrys(eventImage);
    const tokenImageUrl = await uploadToIrys(tokenImage);

    //console.log("Event Image URL:", eventImageUrl);
    //console.log("Token Image URL:", tokenImageUrl);

    mintTokens(tokenImageUrl);
  };

  return (
    <div className="w-full max-w-xl mt-8 p-6 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <h2 className="text-xl font-semibold mb-4 text-center">
        Create a PoP Event
      </h2>

      <div className="flex flex-col gap-4">
        <input
          className="border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm px-4 py-2 rounded-md"
          placeholder="Event Name"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />

        <textarea
          className="border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm px-4 py-2 rounded-md"
          placeholder="Event Description"
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
        />

        <label className="text-sm text-neutral-700 dark:text-neutral-300">
          Upload Event Image
          <input
            type="file"
            accept="image/*"
            className="mt-1 w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-neutral-800"
            onChange={(e) => setEventImage(e.target.files?.[0] || null)}
          />
        </label>

        <input
          className="border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm px-4 py-2 rounded-md"
          placeholder="Token Name"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
        />

        <input
          className="border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm px-4 py-2 rounded-md"
          placeholder="Token Symbol"
          value={tokenSymbol}
          onChange={(e) => setTokenSymbol(e.target.value)}
        />

        <label className="text-sm text-neutral-700 dark:text-neutral-300">
          Upload Token Image
          <input
            type="file"
            accept="image/*"
            className="mt-1 w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-neutral-800"
            onChange={(e) => setTokenImage(e.target.files?.[0] || null)}
          />
        </label>

        <button
          onClick={handleCreateToken}
          className="bg-black text-white px-6 py-2 rounded-full text-sm hover:bg-neutral-800 transition"
        >
          Mint Token & Generate QR
        </button>
      </div>
    </div>
  );
}