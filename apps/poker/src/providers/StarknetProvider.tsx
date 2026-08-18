import React from 'react';
import { sepolia, mainnet } from '@starknet-react/chains';
import { StarknetConfig, jsonRpcProvider, cartridge } from '@starknet-react/core';
import { isLocal } from '../config';
import { controller } from '../controller';

const provider = jsonRpcProvider({
  rpc: (chain) => {
    switch (chain) {
      case mainnet:
      default:
        return { nodeUrl: 'https://api.cartridge.gg/x/starknet/mainnet' };
      case sepolia:
        return { nodeUrl: 'https://api.cartridge.gg/x/starknet/sepolia' };
    }
  },
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      defaultChainId={sepolia.id}
      chains={[mainnet, sepolia]}
      provider={provider}
      connectors={isLocal ? [] : [controller]}
      explorer={cartridge}
      autoConnect={!isLocal}
    >
      {children}
    </StarknetConfig>
  );
}
