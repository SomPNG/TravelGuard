import { useState, useEffect, useCallback } from 'react';
import { peraWallet } from '../lib/algorand';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      const newAccounts = await peraWallet.connect();
      peraWallet.connector?.on('disconnect', handleDisconnect);
      if (newAccounts.length > 0) {
        setAddress(newAccounts[0]);
      }
    } catch (error) {
      if (error?.data?.type !== 'CONNECT_MODAL_CLOSED') {
        console.error('Error connecting to Pera Wallet:', error);
      }
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setAddress(null);
    peraWallet.disconnect();
  }, []);

  const disconnect = useCallback(() => {
    handleDisconnect();
  }, [handleDisconnect]);

  useEffect(() => {
    // Reconnect to the session when the component mounts
    peraWallet.reconnectSession().then((accounts) => {
      peraWallet.connector?.on('disconnect', handleDisconnect);
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      }
    }).catch((error) => {
        // You can handle the error here if needed
        console.error('Error reconnecting session:', error);
    });

    return () => {
        // @ts-ignore
        peraWallet.connector?.off('disconnect');
    }
  }, [handleDisconnect]);

  return { address, connect, disconnect };
}
