// app/layout.tsx
import '../styles/globals.css';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const network = 'devnet'; // You can change this to 'mainnet' or 'testnet'

  // Define the wallet adapters
  const wallets = [
    new PhantomWalletAdapter(),
    new SolletWalletAdapter(),
    // Add other Solana wallet adapters if necessary
  ];

  return (
    <ConnectionProvider endpoint={`https://api.${network}.solana.com`}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen">
            <header className="bg-blue-500 p-4 text-white text-center">
              <h1>Solana Token Minting</h1>
            </header>

            <main>{children}</main>

            <footer className="bg-blue-500 p-4 text-white text-center">
              <p>© 2025 Solana Token Minting</p>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default Layout;
