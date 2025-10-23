
"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type ApiTransaction = {
  request: any;
  response: any;
};

interface ApiTransactionContextType {
  lastApiTransaction: ApiTransaction | null;
  setLastApiTransaction: (transaction: ApiTransaction | null) => void;
}

const ApiTransactionContext = createContext<ApiTransactionContextType | undefined>(undefined);

export const ApiTransactionProvider = ({ children }: { children: ReactNode }) => {
  const [lastApiTransaction, setLastApiTransaction] = useState<ApiTransaction | null>(null);

  return (
    <ApiTransactionContext.Provider value={{ lastApiTransaction, setLastApiTransaction }}>
      {children}
    </ApiTransactionContext.Provider>
  );
};

export const useApiTransaction = () => {
  const context = useContext(ApiTransactionContext);
  if (context === undefined) {
    throw new Error('useApiTransaction must be used within an ApiTransactionProvider');
  }
  return context;
};
