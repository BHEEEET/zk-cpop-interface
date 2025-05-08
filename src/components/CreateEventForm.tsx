"use client";

import { useState } from "react";
import { Keypair } from "@solana/web3.js";
import QRCode from "react-qr-code";
import { WebUploader } from "@irys/web-upload";
import { WebSolana } from "@irys/web-upload-solana";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

export default function CreateEventForm() {
  const [mintAddress, setMintAddress] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventImage, setEventImage] = useState<File | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenImage, setTokenImage] = useState<File | null>(null);

  const wallet = useWallet();

  const uploadToIrys = async (file: File): Promise<string> => {
    if (!wallet) throw new Error("Wallet not connected");
    console.log("test")
    console.log(wallet)
    const irys = await WebUploader(WebSolana).withProvider(wallet);

    console.log("yessss")
    console.log(irys)
    console.log(wallet.publicKey?.toBase58())
  
    const buffer = await file.arrayBuffer();
    const data = Buffer.from(buffer);

    console.log(data)

    const receipt = await irys?.uploadFile(file, {
      tags: [
        { name: "Content-Type", value: file.type },
        { name: "App-Name", value: "PoP-Event" },
      ],
    });
    

    console.log(receipt)

    return `https://gateway.irys.xyz/${receipt.id}`;
  };

  const handleCreateToken = async () => {
    if (!eventImage || !tokenImage ) {
      alert("Please upload both images and connect your wallet");
      return;
    }

    const eventImageUrl = await uploadToIrys(eventImage);
    const tokenImageUrl = await uploadToIrys(tokenImage);

    console.log("Event Image URL:", eventImageUrl);
    console.log("Token Image URL:", tokenImageUrl);

  };

  return (
    <div className="w-full max-w-xl mt-8 p-6 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <h2 className="text-xl font-semibold mb-4 text-center">Create a PoP Event</h2>

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

        {mintAddress && (
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Mint Address:</p>
            <p className="break-all text-xs font-mono mb-4">{mintAddress}</p>
            <QRCode value={mintAddress} className="mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
