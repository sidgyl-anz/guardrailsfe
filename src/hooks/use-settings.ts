
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot, Firestore, Unsubscribe } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const LOCAL_STORAGE_PREFIX = 'safe-health-chat';
const DOMAINS_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}:search-domains`;
const SYSTEM_PROMPT_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}:system-prompt-v2`;
const GUARDRAILS_ENABLED_KEY = `${LOCAL_STORAGE_PREFIX}:guardrails-enabled`;

const DEFAULT_SEARCH_DOMAINS: string[] = ['medlineplus.gov'];
const DEFAULT_SYSTEM_PROMPT = "You are a helpful health assistant for MedlinePlus. Your goal is to provide safe, helpful, and accurate information. Do not provide medical advice, diagnosis, or treatment. Always encourage users to consult with a qualified healthcare professional for any medical concerns.";
const DEFAULT_GUARDRAILS_ENABLED = true;

interface UserSettings {
  searchDomains?: string[];
  systemPrompt?: string;
  useGuardrails?: boolean;
}

// Function to get initial state from localStorage
const getInitialState = () => {
  if (typeof window === 'undefined') {
    return {
      searchDomains: DEFAULT_SEARCH_DOMAINS,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      useGuardrails: DEFAULT_GUARDRAILS_ENABLED,
    };
  }
  try {
    const storedDomains = localStorage.getItem(DOMAINS_STORAGE_KEY);
    const storedSystemPrompt = localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY);
    const storedGuardrails = localStorage.getItem(GUARDRAILS_ENABLED_KEY);

    const searchDomains = storedDomains ? JSON.parse(storedDomains) : DEFAULT_SEARCH_DOMAINS;
    const systemPrompt = storedSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const useGuardrails = storedGuardrails ? JSON.parse(storedGuardrails) : DEFAULT_GUARDRAILS_ENABLED;

    return { searchDomains, systemPrompt, useGuardrails };
  } catch (error) {
    console.error("Failed to read from localStorage", error);
    return {
      searchDomains: DEFAULT_SEARCH_DOMAINS,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      useGuardrails: DEFAULT_GUARDRAILS_ENABLED,
    };
  }
};


export function useSettings() {
  const { firestore, user, isUserLoading } = useFirebase();
  const [isMounted, setIsMounted] = useState(false);

  // Initialize state from localStorage
  const [searchDomains, setSearchDomains] = useState<string[]>(getInitialState().searchDomains);
  const [systemPrompt, setSystemPrompt] = useState<string>(getInitialState().systemPrompt);
  const [useGuardrails, setUseGuardrails] = useState<boolean>(getInitialState().useGuardrails);

  // Sync state with Firestore when user logs in
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (user && firestore) {
      const userSettingsRef = doc(firestore, 'users', user.uid);
      
      unsubscribe = onSnapshot(userSettingsRef, 
        (docSnap) => {
          if (docSnap.exists()) {
            const settings = docSnap.data() as UserSettings;
            setSearchDomains(settings.searchDomains ?? DEFAULT_SEARCH_DOMAINS);
            setSystemPrompt(settings.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
            setUseGuardrails(settings.useGuardrails ?? DEFAULT_GUARDRAILS_ENABLED);
          } else {
            // If no settings in Firestore, write the current (local or default) settings
             const initialSettings = {
               searchDomains: getInitialState().searchDomains,
               systemPrompt: getInitialState().systemPrompt,
               useGuardrails: getInitialState().useGuardrails,
             };
             setDoc(userSettingsRef, initialSettings, { merge: true }).catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: userSettingsRef.path,
                    operation: 'create',
                    requestResourceData: initialSettings,
                });
                errorEmitter.emit('permission-error', permissionError);
             });
          }
        },
        (error) => {
            const permissionError = new FirestorePermissionError({
                path: userSettingsRef.path,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
      );

    } else if (!isUserLoading) {
      // User logged out, reset to localStorage/defaults
      const initialState = getInitialState();
      setSearchDomains(initialState.searchDomains);
      setSystemPrompt(initialState.systemPrompt);
      setUseGuardrails(initialState.useGuardrails);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, isUserLoading, firestore]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateSetting = <T>(key: keyof UserSettings, value: T) => {
    if (user && firestore) {
      const userSettingsRef = doc(firestore, 'users', user.uid);
      const data = { [key]: value };
      setDoc(userSettingsRef, data, { merge: true }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: userSettingsRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    } else {
        try {
            if (key === 'searchDomains') {
                 localStorage.setItem(DOMAINS_STORAGE_KEY, JSON.stringify(value));
            } else if (key === 'systemPrompt') {
                 localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, value as string);
            } else if (key === 'useGuardrails') {
                 localStorage.setItem(GUARDRAILS_ENABLED_KEY, JSON.stringify(value));
            }
        } catch (error) {
            console.error(`Failed to write ${key} to localStorage`, error);
        }
    }
  };

  const saveSearchDomains = useCallback((domains: string[]) => {
    setSearchDomains(domains);
    updateSetting('searchDomains', domains);
  }, [user, firestore]);

  const saveSystemPrompt = useCallback((prompt: string) => {
    setSystemPrompt(prompt);
    updateSetting('systemPrompt', prompt);
  }, [user, firestore]);

  const saveUseGuardrails = useCallback((enabled: boolean) => {
    setUseGuardrails(enabled);
    updateSetting('useGuardrails', enabled);
  }, [user, firestore]);

  return {
    searchDomains,
    systemPrompt,
    useGuardrails,
    setSearchDomains: saveSearchDomains,
    setSystemPrompt: saveSystemPrompt,
    setUseGuardrails: saveUseGuardrails,
    isSettingsReady: isMounted && !isUserLoading,
  };
}
