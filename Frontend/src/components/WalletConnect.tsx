import { useState, useEffect } from 'react';
import { Wallet, LogOut } from 'lucide-react';
import { peraWallet, truncateAddress } from '../lib/algorand';

export default function WalletConnect({ 
  accountAddress, 
  setAccountAddress 
}: { 
  accountAddress: string | null; 
  setAccountAddress: (addr: string | null) => void;
}) {
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Reconnect to the session when the component is mounted
    peraWallet.reconnectSession().then((accounts) => {
      peraWallet.connector?.on('disconnect', handleDisconnectWalletClick);
      if (accounts.length) {
        setAccountAddress(accounts[0]);
      }
    }).catch((e) => console.log(e));
  }, []);

  const handleConnectWalletClick = async () => {
    try {
      setIsConnecting(true);
      const newAccounts = await peraWallet.connect();
      peraWallet.connector?.on('disconnect', handleDisconnectWalletClick);
      setAccountAddress(newAccounts[0]);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWalletClick = () => {
    peraWallet.disconnect();
    setAccountAddress(null);
  };

  if (accountAddress) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-300">
          <div className="h-2 w-2 rounded-full bg-teal-400"></div>
          {truncateAddress(accountAddress)}
        </div>
        <button
          onClick={handleDisconnectWalletClick}
          className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          title="Disconnect Wallet"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnectWalletClick}
      disabled={isConnecting}
      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:scale-105 hover:shadow-teal-500/40 disabled:opacity-50 disabled:hover:scale-100"
    >
      <Wallet className="h-4 w-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
