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
  calculateComputeUnitPrice,
  dedupeSigner,
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
  getOrCreateAssociatedTokenAccount,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import {
  Account,
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

export default function Airdrop() {
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

    return signature;
  };

  // const airdrop = async () => {
  //   const connection = createRpc(RPC_ENDPOINT, RPC_ENDPOINT, RPC_ENDPOINT);
  //   const MINT_ADDRESS = new PublicKey(
  //     "Eo9aToVx4TyPSM63XjY3ycD5jJEENqXTCcovcFvmWKJc"
  //   );

  //   const activeStateTrees = await connection.getStateTreeInfos();
  //   const treeInfo = selectStateTreeInfo(activeStateTrees);

  //   const infos = await getTokenPoolInfos(connection, MINT_ADDRESS);
  //   const info = selectTokenPoolInfo(infos);

  //   const associatedToken = await getAssociatedTokenAddress(
  //     MINT_ADDRESS,
  //     wallet.publicKey!,
  //     false,
  //     TOKEN_2022_PROGRAM_ID
  //   );

  //   let ata;
  //   try {
  //     ata = await getAccount(
  //       connection,
  //       associatedToken,
  //       "confirmed",
  //       TOKEN_2022_PROGRAM_ID
  //     );
  //   } catch (error: unknown) {
  //     if (
  //       error instanceof TokenAccountNotFoundError ||
  //       error instanceof TokenInvalidAccountOwnerError
  //     ) {
  //       try {
  //         const transaction = new Transaction().add(
  //           createAssociatedTokenAccountInstruction(
  //             wallet.publicKey!,
  //             associatedToken,
  //             wallet.publicKey!,
  //             MINT_ADDRESS,
  //             TOKEN_2022_PROGRAM_ID
  //           )
  //         );

  //         await sendTransaction(transaction, connection);
  //       } catch (error: unknown) {}
  //       ata = await getAccount(
  //         connection,
  //         associatedToken,
  //         "confirmed",
  //         TOKEN_2022_PROGRAM_ID
  //       );
  //     } else {
  //       throw error;
  //     }
  //   }

  //   const airdropAddresses = [
  //     "3PKhzE9wuEkGPHHu2sNCvG86xNtDJduAcyBPXpE6cSNt",
  //     "14rghAS2vY4w4BGvm89SRdhwqVGvTZRd6QDmDgsag4Es",
  //     "CinHb6Xt2PnqKUkmhRo9hwUkixCcsH1uviuQqaTxwT9i",
  //     "2rdAG46kJdmsQMSFuVYWQsatsq5UTm6oVZWVXPrCMpsx",
  //     "BcgYRPQC4mE3e195FmTx4mspmGbDx5xdcdKuLwNG89ov",
  //     "1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix",
  //     "7pPJt2xoEoPy8x8Hf2D6U6oLfNa5uKmHHRwkENVoaxmA",
  //     "BumrJWH5kf4MXZ5bEg7VyZY6oXAMr78jXC1mFiDAE3u3",
  //     "6tGrE4vH64VUCQK5TFvcqh4L89vV5xpzriaJweHvYgPo",
  //   ].map((address) => new PublicKey(address));

  //   const amount = bn(111);

  //   const instructions = [];
  //   instructions.push(
  //     ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }),
  //     ComputeBudgetProgram.setComputeUnitPrice({
  //       // Replace this with a dynamic priority_fee based on network conditions.
  //       microLamports: calculateComputeUnitPrice(20_000, 120_000),
  //     })
  //   );

  //   const compressInstruction = await CompressedTokenProgram.compress({
  //     payer: wallet.publicKey!,
  //     owner: wallet.publicKey!,
  //     source: associatedToken,
  //     toAddress: airdropAddresses,
  //     amount: airdropAddresses.map(() => amount),
  //     mint: MINT_ADDRESS,
  //     tokenPoolInfo: info,
  //     outputStateTreeInfo: treeInfo,
  //   });
  //   instructions.push(compressInstruction);

  //   const additionalSigners = dedupeSigner(payer, [owner]);
  //   const { blockhash } = await connection.getLatestBlockhash();

  //   const tx = buildAndSignTx(
  //     instructions,
  //     wallet.publicKey,
  //     blockhash,
  //     additionalSigners
  //   );

  //   const txId = await sendAndConfirmTx(connection, tx);
  //   console.log(`txId: ${txId}`);
  // };

  // const handleAirdrop = async () => {
  //   airdrop();
  //   console.log("hyee");
  // };

  return (
    <div className="w-full max-w-xl mt-8 p-6 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <h2 className="text-xl font-semibold mb-4 text-center">
        Airdrop Dashboard
      </h2>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => {console.log("test")}}
          className="bg-black text-white px-6 py-2 rounded-full text-sm hover:bg-neutral-800 transition"
        >
          Send Airdrop
        </button>
      </div>
    </div>
  );
}
