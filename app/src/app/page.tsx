"use client"; // Add this line

import dynamic from "next/dynamic";
// Dynamically import the WalletMultiButton component on the client only
const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import CreateEventForm from "@/components/CreateEventForm";
import { WalletDisconnectButton } from "@solana/wallet-adapter-react-ui";
import Airdrop from "@/components/Airdrop";



export default function Home() {
  const { publicKey } = useWallet();

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        {/*  <Image
          className="dark:invert"
          src="/token-logo.svg" // Replace with your token logo
          alt="Token Logo"
          width={180}
          height={38}
          priority
        />
      */}
        <h1 className="text-4xl font-semibold text-center sm:text-left">
          Welcome to the ZK cPOP platform
        </h1>
        <p className="text-center sm:text-left text-lg">
          Make your own Proof of Participation token now! Cheaper and faster,
          IBRL!
        </p>

        <div className="flex flex-col gap-6 items-center sm:items-start w-full">
          <WalletMultiButtonDynamic />
          <WalletDisconnectButton/>
          {publicKey && <div><CreateEventForm /> <Airdrop/></div>}
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://www.zkcompression.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Token Documentation
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://www.yourtoken.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Visit Official Site →
        </a>
      </footer>
    </div>
  );
}
