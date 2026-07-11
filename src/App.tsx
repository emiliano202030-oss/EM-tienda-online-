/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, 
  Coins, 
  Settings, 
  RotateCcw,
  CheckCircle,
  TrendingUp,
  Sliders,
  DollarSign,
  Share2,
  ExternalLink,
  Cloud,
  CloudOff,
  RefreshCw,
  Copy,
  Check,
  MessageCircle
} from 'lucide-react';

import { Product, Sale, ClientDebt, CartItem, AppState } from './types';
import { INITIAL_PRODUCTS, INITIAL_SALES, INITIAL_DEBTS, DEFAULT_EXCHANGE_RATE, DEFAULT_CATALOG_SHARE_TEMPLATE, DEFAULT_DEBT_REMINDER_TEMPLATE } from './data/mockData';

import BottomNav, { TabType } from './components/BottomNav';
import CajaPOS from './components/CajaPOS';
import Deposito from './components/Deposito';
import Fiados from './components/Fiados';
import Historial from './components/Historial';
import Metricas from './components/Metricas';
import CatalogoCliente from './components/CatalogoCliente';

import { 
  isSupabaseConfigured, 
  supabase, 
  loadStateFromSupabase, 
  saveStateToSupabase, 
  SUPABASE_SQL_SETUP,
  isConfiguredViaEnv,
  saveCustomCredentials,
  clearCustomCredentials,
  fetchProductsFromSupabase,
  saveProductToSupabase,
  deleteProductFromSupabase,
  updateProductStockInSupabase,
  mapRowToProduct
} from './lib/supabase';

function serializeCatalogData(state: AppState): string {
  try {
    // Solo serializamos productos activos con stock, y solo los campos necesarios para reducir la longitud de la URL.
    const filteredProducts = (state.products || [])
      .filter(p => p.stock > 0)
      .map(p => ({
        i: p.id,
        n: p.name,
        p: p.price,
        s: p.stock,
        c: p.category,
        g: p.image && p.image.startsWith('data:') ? '' : p.image // no serializamos Base64 pesado para mantener la URL pequeña
      }));

    const data = {
      r: state.exchangeRate,
      w: state.whatsappPhone,
      p: filteredProducts
    };

    const json = JSON.stringify(data);
    return btoa(encodeURIComponent(json));
  } catch (e) {
    console.error('Error serializing catalog data:', e);
    return '';
  }
}

function deserializeCatalogData(encoded: string): Partial<AppState> | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const data = JSON.parse(json);
    const products: Product[] = (data.p || []).map((p: any) => ({
      id: p.i,
      name: p.n,
      sku: '',
      price: p.p,
      cost: 0,
      profitPercent: 0,
      stock: p.s,
      minStock: 0,
      category: p.c,
      image: p.g || ''
    }));
    return {
      products,
      exchangeRate: data.r,
      whatsappPhone: data.w
    };
  } catch (e) {
    console.error('Error deserializing catalog data:', e);
    return null;
  }
}

const LOCAL_STORAGE_KEY = 'em_tienda_app_state_v3';

export default function App() {
  // Check URL query parameters for public catalog mode
  const [isCatalogMode, setIsCatalogMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('view') === 'catalogo' || params.get('mode') === 'catalogo' || params.get('catalogo') === 'true';
    }
    return false;
  });

  // URL catalog data
  const urlCatalogData = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get('data');
      if (dataParam) {
        return deserializeCatalogData(dataParam);
      }
    }
    return null;
  }, []);

  // App state
  const [state, rawSetState] = useState<AppState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get('data');
      if (dataParam) {
        const urlData = deserializeCatalogData(dataParam);
        if (urlData) {
          return {
            products: urlData.products || [],
            sales: [],
            debts: [],
            exchangeRate: urlData.exchangeRate || DEFAULT_EXCHANGE_RATE,
            whatsappPhone: urlData.whatsappPhone || '584120000000'
          };
        }
      }
    }
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.whatsappPhone) {
          parsed.whatsappPhone = '584120000000';
        }
        return parsed;
      } catch (e) {
        console.error('Error reading localStorage state', e);
      }
    }
    return {
      products: INITIAL_PRODUCTS,
      sales: INITIAL_SALES,
      debts: INITIAL_DEBTS,
      exchangeRate: DEFAULT_EXCHANGE_RATE,
      whatsappPhone: '584120000000'
    };
  });

  // Use refs to prevent infinite loop updates
  const skipNextSaveRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state; // Keep latest state in ref for safe async operations

  // Smart state setter wrapper to automatically track the exact last write timestamp
  const setState = React.useCallback((value: AppState | ((prev: AppState) => AppState)) => {
    rawSetState(prev => {
      const next = typeof value === 'function' ? (value as Function)(prev) : value;
      if (isCatalogMode) return next;
      
      // If we are loading from Supabase, preserve its existing updatedAt or timestamp
      if (skipNextSaveRef.current) {
        return next;
      }
      
      return {
        ...next,
        updatedAt: new Date().toISOString()
      };
    });
  }, [isCatalogMode]);

  // Current selected tab
  const [activeTab, setActiveTab] = useState<TabType>('caja');

  // Modal handlers triggers
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempRate, setTempRate] = useState<string>(state.exchangeRate.toString());
  const [tempPhone, setTempPhone] = useState<string>(state.whatsappPhone || '584120000000');
  const [tempCatalogTemplate, setTempCatalogTemplate] = useState<string>(state.catalogShareTemplate || DEFAULT_CATALOG_SHARE_TEMPLATE);
  const [tempDebtTemplate, setTempDebtTemplate] = useState<string>(state.debtReminderTemplate || DEFAULT_DEBT_REMINDER_TEMPLATE);

  // Sync temp variables when modal is opened or when state changes
  useEffect(() => {
    setTempRate(state.exchangeRate.toString());
    setTempPhone(state.whatsappPhone || '584120000000');
    setTempCatalogTemplate(state.catalogShareTemplate || DEFAULT_CATALOG_SHARE_TEMPLATE);
    setTempDebtTemplate(state.debtReminderTemplate || DEFAULT_DEBT_REMINDER_TEMPLATE);
  }, [state.exchangeRate, state.whatsappPhone, state.catalogShareTemplate, state.debtReminderTemplate]);

  // Save state to localStorage whenever it changes, strictly disabling in catalog mode to prevent administrative state overrides
  useEffect(() => {
    if (isCatalogMode) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error al guardar el estado en localStorage:', e);
    }
  }, [state, isCatalogMode]);

  // --- Supabase Sincronización Layer ---
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'not-configured'>(
    isSupabaseConfigured ? 'syncing' : 'not-configured'
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastCloudUpdate, setLastCloudUpdate] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [hasLoadedFromCloud, setHasLoadedFromCloud] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'templates' | 'supabase'>('general');
  const [sqlCopied, setSqlCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_SUPABASE_URL') : '') || '';
  });
  const [manualKey, setManualKey] = useState(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') : '') || '';
  });

  // 1. Initial State Loading from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setHasLoadedFromCloud(true);
      return;
    }

    let active = true;

    async function initSupabase() {
      try {
        setSyncStatus('syncing');
        
        // Fetch products directly from the relational "productos" table
        const dbProducts = await fetchProductsFromSupabase();
        const cloudData = await loadStateFromSupabase();
        
        if (!active) return;

        const parseDate = (d?: string) => d ? new Date(d).getTime() : 0;
        const localTime = parseDate(stateRef.current?.updatedAt);
        const cloudTime = parseDate(cloudData?.state?.updatedAt || cloudData?.updatedAt);

        // Check if there is local data and whether cloud is empty
        const hasLocalProducts = stateRef.current.products.length > 0;
        const hasLocalSales = stateRef.current.sales.length > 0;
        const hasLocalDebts = stateRef.current.debts.length > 0;
        const hasLocalData = hasLocalProducts || hasLocalSales || hasLocalDebts;

        const hasCloudProducts = dbProducts !== null && dbProducts.length > 0;
        const hasCloudState = cloudData !== null;
        const hasCloudData = hasCloudProducts || hasCloudState;

        // CRITICAL SYNC PROTECTION:
        // If Supabase is completely empty/uninitialized, but we have local data,
        // sync local data UP to Supabase instead of wiping out the user's data!
        if (hasLocalData && !hasCloudData) {
          console.log('[Supabase Sync] Cloud is empty but local state has data. Initializing Supabase with local state...');
          
          // Save state (sales, debts, metadata)
          await saveStateToSupabase(stateRef.current);
          
          // Save all products to postgres table
          if (stateRef.current.products.length > 0) {
            for (const prod of stateRef.current.products) {
              await saveProductToSupabase(prod, true);
            }
          }
          
          setLastCloudUpdate(new Date().toISOString());
          setSyncStatus('synced');
          setHasLoadedFromCloud(true);
          return; // Retain local state
        }

        let finalProducts = stateRef.current.products;
        let finalSales = stateRef.current.sales;
        let finalDebts = stateRef.current.debts;
        let finalExchangeRate = stateRef.current.exchangeRate;
        let finalWhatsappPhone = stateRef.current.whatsappPhone;

        if (cloudData && (localTime === 0 || cloudTime >= localTime)) {
          // Cloud is newer or equal: load cloud state
          const loadedState = { ...cloudData.state };
          finalSales = loadedState.sales || [];
          finalDebts = loadedState.debts || [];
          finalExchangeRate = loadedState.exchangeRate || DEFAULT_EXCHANGE_RATE;
          finalWhatsappPhone = loadedState.whatsappPhone || '584120000000';
          
          // Triple-redundancy product loading system:
          // 1. Primary: Load from relational postgres "productos" table if successfully fetched and has products
          // 2. Secondary Fallback: Load from state JSON fallback if relational is empty or null
          // 3. Last Line of Defense: If both cloud sources are empty/null, retain the existing local storage products to prevent data loss
          if (dbProducts !== null && dbProducts.length > 0) {
            finalProducts = dbProducts;
          } else if (loadedState.products && loadedState.products.length > 0) {
            console.log('[Supabase Sync fallback] Using fallback products from state JSON...', loadedState.products.length);
            finalProducts = loadedState.products;
          } else {
            console.log('[Supabase Sync last-line-defense] Retaining local storage products to prevent data loss...');
            finalProducts = stateRef.current.products;
          }
        } else if (cloudData && localTime > cloudTime) {
          // Local is newer: push local state to Supabase
          console.log('[Supabase Sync] Local state is newer. Pushing newer local state to Supabase...');
          await saveStateToSupabase(stateRef.current);
          if (stateRef.current.products.length > 0) {
            for (const prod of stateRef.current.products) {
              await saveProductToSupabase(prod);
            }
          }
          setLastCloudUpdate(new Date().toISOString());
          setSyncStatus('synced');
          setHasLoadedFromCloud(true);
          return; // Retain local state
        } else {
          // If there is no cloudData, but we fetched products from Supabase successfully
          if (dbProducts !== null && dbProducts.length > 0) {
            finalProducts = dbProducts;
          } else {
            // Keep local products as defense if dbProducts is empty
            finalProducts = stateRef.current.products;
          }
        }

        const loadedState: AppState = {
          products: finalProducts,
          sales: finalSales,
          debts: finalDebts,
          exchangeRate: finalExchangeRate,
          whatsappPhone: finalWhatsappPhone,
          catalogShareTemplate: cloudData?.state?.catalogShareTemplate || stateRef.current.catalogShareTemplate,
          debtReminderTemplate: cloudData?.state?.debtReminderTemplate || stateRef.current.debtReminderTemplate,
          updatedAt: cloudData?.state?.updatedAt || stateRef.current.updatedAt || new Date().toISOString()
        };

        skipNextSaveRef.current = true;
        setState(loadedState);
        setLastCloudUpdate(cloudData?.updatedAt || new Date().toISOString());
        setSyncStatus('synced');
        setHasLoadedFromCloud(true);
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        const isNetworkOrAuth = errMsg.includes('fetch') || errMsg.includes('Network') || errMsg.includes('Failed to fetch') || errMsg.includes('network');
        
        if (isNetworkOrAuth) {
          console.warn('[Supabase Sync Warning] Connection issue in initSupabase:', errMsg);
        } else {
          console.error('[Supabase Sync Error] Failed to load state from Supabase:', error);
        }
        if (active) {
          setSyncStatus('error');
          setSyncError(error?.message || String(error));
          setHasLoadedFromCloud(true);
        }
      }
    }

    initSupabase();

    // 2. Real-time Subscription to changes from other devices
    if (!supabase) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'em_tienda_sync',
          filter: 'id=eq.main_inventory_state'
        },
        (payload) => {
          if (!active) return;
          
          const newRecord = payload.new as { state: AppState; updated_at: string } | null;
          
          if (newRecord && newRecord.state) {
            // Compare timestamps to prevent outdated states or loop overrides
            setLastCloudUpdate(prev => {
              if (!prev || new Date(newRecord.updated_at) > new Date(prev)) {
                skipNextSaveRef.current = true;
                
                const loadedState = { ...newRecord.state };
                if (loadedState.exchangeRate === undefined || loadedState.exchangeRate === null || isNaN(loadedState.exchangeRate)) {
                  loadedState.exchangeRate = DEFAULT_EXCHANGE_RATE;
                }
                if (!loadedState.whatsappPhone) {
                  loadedState.whatsappPhone = '584120000000';
                }
                if (!loadedState.products) loadedState.products = [];
                if (!loadedState.sales) loadedState.sales = [];
                if (!loadedState.debts) loadedState.debts = [];

                setState(prev => ({
                  ...prev,
                  sales: loadedState.sales,
                  debts: loadedState.debts,
                  exchangeRate: loadedState.exchangeRate,
                  whatsappPhone: loadedState.whatsappPhone,
                  catalogShareTemplate: loadedState.catalogShareTemplate || prev.catalogShareTemplate,
                  debtReminderTemplate: loadedState.debtReminderTemplate || prev.debtReminderTemplate
                }));
                return newRecord.updated_at;
              }
              return prev;
            });
            setSyncStatus('synced');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'productos'
        },
        (payload) => {
          if (!active) return;
          console.log('[Supabase Realtime] Direct product change:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updatedProd = mapRowToProduct(payload.new);
            setState(prev => {
              const exists = prev.products.some(p => p.id === updatedProd.id);
              return {
                ...prev,
                products: exists
                  ? prev.products.map(p => p.id === updatedProd.id ? updatedProd : p)
                  : [...prev.products, updatedProd]
              };
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setState(prev => ({
                ...prev,
                products: prev.products.filter(p => p.id !== deletedId)
              }));
            }
          }
        }
      )
      .subscribe((status) => {
        if (active) {
          setIsRealtimeActive(status === 'SUBSCRIBED');
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isCatalogMode]);

  // 3. Debounced Cloud Saving
  useEffect(() => {
    if (!isSupabaseConfigured || isCatalogMode) return;
    if (!hasLoadedFromCloud) return; // Prevent saving local state before the initial sync from Supabase has completed

    // Check if we should skip this save (e.g., if it was caused by a cloud pull)
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setSyncStatus('syncing');

    const timeoutId = setTimeout(async () => {
      try {
        const savedTime = await saveStateToSupabase(state);
        if (savedTime) {
          setLastCloudUpdate(savedTime);
          setSyncStatus('synced');
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isNetworkOrAuth = errMsg.includes('fetch') || errMsg.includes('Network') || errMsg.includes('Failed to fetch') || errMsg.includes('network');
        
        if (isNetworkOrAuth) {
          console.warn('[Supabase Sync Warning] Connection issue in debounced save:', errMsg);
        } else {
          console.error('[Supabase Sync Error] Error in debounced state save to Supabase:', err);
        }
        setSyncStatus('error');
        setSyncError(err?.message || String(err));
      }
    }, 1500); // 1.5 seconds debounce

    return () => clearTimeout(timeoutId);
  }, [state, isCatalogMode, hasLoadedFromCloud]);


  // Handle setting rate and whatsapp phone updates
  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(tempRate) || DEFAULT_EXCHANGE_RATE;
    const phone = tempPhone.trim() || '584120000000';
    setState(prev => ({ 
      ...prev, 
      exchangeRate: rate,
      whatsappPhone: phone
    }));
    setIsSettingsOpen(false);
    alert(`Parámetros guardados con éxito:\nTasa: ${rate} Bs/$\nWhatsApp: ${phone}`);
  };

  const handleSaveTemplates = (e: React.FormEvent) => {
    e.preventDefault();
    setState(prev => ({
      ...prev,
      catalogShareTemplate: tempCatalogTemplate,
      debtReminderTemplate: tempDebtTemplate
    }));
    setIsSettingsOpen(false);
    alert('Plantillas de mensajes de WhatsApp guardadas con éxito.');
  };

  // Reset to default factory mock state
  const handleResetData = () => {
    if (confirm('¿Estás seguro de que deseas restablecer TODOS los datos de prueba de EM TIENDA? Se borrarán tus cambios.')) {
      setState({
        products: INITIAL_PRODUCTS,
        sales: INITIAL_SALES,
        debts: INITIAL_DEBTS,
        exchangeRate: DEFAULT_EXCHANGE_RATE,
        whatsappPhone: '584120000000'
      });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      alert('Datos restablecidos con éxito.');
    }
  };

  // ----------------------------------------------------
  // INVENTORY MUTATION HANDLERS
  // ----------------------------------------------------
  const handleAddProduct = (newProd: Product) => {
    setState(prev => ({
      ...prev,
      products: [...prev.products, newProd]
    }));
    if (isSupabaseConfigured) {
      saveProductToSupabase(newProd, true).catch(e => console.error('Error saving product to Supabase:', e));
    }
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    setState(prev => ({
      ...prev,
      products: prev.products.map(p => p.id === updatedProd.id ? updatedProd : p)
    }));
    if (isSupabaseConfigured) {
      saveProductToSupabase(updatedProd).catch(e => console.error('Error updating product in Supabase:', e));
    }
  };

  const handleDeleteProduct = (id: string) => {
    setState(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id)
    }));
    if (isSupabaseConfigured) {
      deleteProductFromSupabase(id).catch(e => console.error('Error deleting product from Supabase:', e));
    }
  };

  // ----------------------------------------------------
  // DEBTOR / CARTERA CREDITS HANDLERS
  // ----------------------------------------------------
  const handleAddClientDebtor = (name: string, phone: string) => {
    const trimmedName = name.trim();
    const existingClient = state.debts.find(
      c => c.clientName.toLowerCase().trim() === trimmedName.toLowerCase()
    );

    if (existingClient) {
      setState(prev => ({
        ...prev,
        debts: prev.debts.map(c => {
          if (c.clientName.toLowerCase().trim() === trimmedName.toLowerCase()) {
            return {
              ...c,
              phone: phone && phone !== 'N/A' ? phone : c.phone,
              movements: [
                ...(c.movements || []),
                {
                  id: `move-dup-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'registro',
                  description: 'Se intentó registrar nuevamente; agrupado bajo el perfil existente.',
                  amountUSD: 0,
                  remainingPendingUSD: c.totalPendingUSD
                }
              ]
            };
          }
          return c;
        })
      }));
      return;
    }

    const newClient: ClientDebt = {
      id: `client-${Date.now()}`,
      clientName: trimmedName,
      phone,
      debts: [],
      totalPendingUSD: 0,
      movements: [
        {
          id: `move-init-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'registro',
          description: 'Cliente registrado en cartera de crédito',
          amountUSD: 0,
          remainingPendingUSD: 0
        }
      ]
    };
    setState(prev => ({
      ...prev,
      debts: [...prev.debts, newClient]
    }));
  };

  // Abonos with oldest-to-newest amortization logic as requested
  const handleRegisterAbono = (clientId: string, amountUSD: number) => {
    setState(prev => {
      let remainingAbono = amountUSD;

      const updatedDebts = prev.debts.map(client => {
        if (client.id !== clientId) return client;

        // Amortize starting from oldest unpaid debt item
        // clone debts to modify
        const debtsCopy = client.debts.map(debt => ({ ...debt }));
        
        // Sort by date ascending to pay oldest first
        const sortedUnpaidIndices = debtsCopy
          .map((d, index) => ({ d, index }))
          .filter(item => !item.d.isPaid)
          .sort((a, b) => new Date(a.d.date).getTime() - new Date(b.d.date).getTime());

        for (const { index } of sortedUnpaidIndices) {
          if (remainingAbono <= 0) break;

          const debt = debtsCopy[index];
          if (remainingAbono >= debt.remainingUSD) {
            remainingAbono -= debt.remainingUSD;
            debt.remainingUSD = 0;
            debt.isPaid = true;
          } else {
            debt.remainingUSD -= remainingAbono;
            remainingAbono = 0;
          }
        }

        // Calculate total pending remaining balance
        const newTotalPending = debtsCopy
          .filter(d => !d.isPaid)
          .reduce((sum, d) => sum + d.remainingUSD, 0);

        // Add movement
        const newMovement = {
          id: `move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: new Date().toISOString(),
          type: 'abono' as const,
          description: `Abono de $${amountUSD.toFixed(2)} USD`,
          amountUSD: amountUSD,
          remainingPendingUSD: newTotalPending
        };

        return {
          ...client,
          debts: debtsCopy,
          totalPendingUSD: newTotalPending,
          movements: [...(client.movements || []), newMovement]
        };
      });

      return {
        ...prev,
        debts: updatedDebts
      };
    });
  };

  const handleUpdateClientPhone = (clientId: string, phone: string) => {
    setState(prev => ({
      ...prev,
      debts: prev.debts.map(client => client.id === clientId ? { ...client, phone } : client)
    }));
  };

  // ----------------------------------------------------
  // TRANSACTION SALES HANDLER
  // ----------------------------------------------------
  const handleCompleteSale = (sale: Sale, cart: CartItem[]) => {
    setState(prev => {
      // 1. Deduct stock from products
      const updatedProducts = prev.products.map(product => {
        const cartItem = cart.find(item => item.product.id === product.id);
        if (cartItem) {
          const nextStock = Math.max(0, product.stock - cartItem.quantity);
          if (isSupabaseConfigured) {
            updateProductStockInSupabase(product.id, nextStock).catch(e => console.error('Error updating stock in Supabase:', e));
          }
          return {
            ...product,
            stock: nextStock
          };
        }
        return product;
      });

      // 2. Append new sale
      const updatedSales = [...prev.sales, sale];

      // 3. Handle credit sale (Fiados)
      let updatedDebts = [...prev.debts];
      if (sale.paymentMethod === 'Crédito' && sale.clientName) {
        const clientNameNormalized = sale.clientName.trim();
        const existingClientIndex = updatedDebts.findIndex(
          c => c.clientName.toLowerCase() === clientNameNormalized.toLowerCase()
        );

        const newDebtItem = {
          id: sale.id,
          date: sale.date,
          productSummary: cart.map(i => `${i.quantity}x ${i.product.name}`).join(', '),
          amountUSD: sale.totalUSD,
          remainingUSD: sale.totalUSD,
          isPaid: false
        };

        if (existingClientIndex !== -1) {
          // Append to existing client
          const client = updatedDebts[existingClientIndex];
          const clientDebtsCopy = [...client.debts, newDebtItem];
          const newPending = clientDebtsCopy
            .filter(d => !d.isPaid)
            .reduce((sum, d) => sum + d.remainingUSD, 0);

          const newMovement = {
            id: `move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: sale.date,
            type: 'compra' as const,
            description: `Compra a crédito: ${newDebtItem.productSummary}`,
            amountUSD: sale.totalUSD,
            remainingPendingUSD: newPending
          };

          const updatedPhone = sale.clientPhone && sale.clientPhone !== 'N/A' ? sale.clientPhone : client.phone;

          updatedDebts[existingClientIndex] = {
            ...client,
            phone: updatedPhone,
            debts: clientDebtsCopy,
            totalPendingUSD: newPending,
            movements: [...(client.movements || []), newMovement]
          };
        } else {
          // Create new client
          const newMovement = {
            id: `move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: sale.date,
            type: 'compra' as const,
            description: `Compra a crédito: ${newDebtItem.productSummary}`,
            amountUSD: sale.totalUSD,
            remainingPendingUSD: sale.totalUSD
          };

          const newClient: ClientDebt = {
            id: `client-${Date.now()}`,
            clientName: clientNameNormalized,
            phone: sale.clientPhone || 'N/A',
            debts: [newDebtItem],
            totalPendingUSD: sale.totalUSD,
            movements: [
              {
                id: `move-init-${Date.now()}`,
                date: new Date().toISOString(),
                type: 'registro' as const,
                description: 'Cliente registrado en cartera de crédito',
                amountUSD: 0,
                remainingPendingUSD: 0
              },
              newMovement
            ]
          };
          updatedDebts.push(newClient);
        }
      }

      return {
        ...prev,
        products: updatedProducts,
        sales: updatedSales,
        debts: updatedDebts
      };
    });
  };

  const handleDeleteClient = (clientId: string) => {
    setState(prev => {
      const client = prev.debts.find(c => c.id === clientId);
      if (!client) return prev;

      // Find all unpaid debts of this client
      const unpaidDebts = client.debts.filter(d => !d.isPaid);

      // Restore stock for all products in these unpaid debts
      const updatedProducts = [...prev.products];
      unpaidDebts.forEach(debt => {
        // Find matching sale
        const sale = prev.sales.find(s => s.id === debt.id);
        if (sale) {
          sale.items.forEach(item => {
            const prodIdx = updatedProducts.findIndex(p => p.id === item.productId);
            if (prodIdx !== -1) {
              const nextStock = updatedProducts[prodIdx].stock + item.quantity;
              updatedProducts[prodIdx] = {
                ...updatedProducts[prodIdx],
                stock: nextStock
              };
              if (isSupabaseConfigured) {
                updateProductStockInSupabase(item.productId, nextStock).catch(e => console.error('Error updating stock in Supabase:', e));
              }
            }
          });
        }
      });

      // Filter out this client
      const updatedDebts = prev.debts.filter(c => c.id !== clientId);

      // Mark associated sales as refunded/voided for consistency
      const unpaidSaleIds = unpaidDebts.map(d => d.id);
      const updatedSales = prev.sales.map(s => {
        if (unpaidSaleIds.includes(s.id)) {
          return { ...s, isRefunded: true };
        }
        return s;
      });

      return {
        ...prev,
        products: updatedProducts,
        debts: updatedDebts,
        sales: updatedSales
      };
    });
    alert('Cliente eliminado con éxito y productos devueltos al depósito.');
  };

  const handleDeleteClientDebt = (clientId: string, debtId: string) => {
    setState(prev => {
      const client = prev.debts.find(c => c.id === clientId);
      if (!client) return prev;

      const debt = client.debts.find(d => d.id === debtId);
      if (!debt) return prev;

      // Restore stock of products in this debt if it was unpaid
      const updatedProducts = [...prev.products];
      if (!debt.isPaid) {
        const sale = prev.sales.find(s => s.id === debt.id);
        if (sale) {
          sale.items.forEach(item => {
            const prodIdx = updatedProducts.findIndex(p => p.id === item.productId);
            if (prodIdx !== -1) {
              const nextStock = updatedProducts[prodIdx].stock + item.quantity;
              updatedProducts[prodIdx] = {
                ...updatedProducts[prodIdx],
                stock: nextStock
              };
              if (isSupabaseConfigured) {
                updateProductStockInSupabase(item.productId, nextStock).catch(e => console.error('Error updating stock in Supabase:', e));
              }
            }
          });
        }
      }

      // Filter out this debt item
      const updatedClientDebts = client.debts.filter(d => d.id !== debtId);
      const newPending = updatedClientDebts
        .filter(d => !d.isPaid)
        .reduce((sum, d) => sum + d.remainingUSD, 0);

      const newMovement = {
        id: `move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: new Date().toISOString(),
        type: 'reembolso' as const,
        description: `Eliminación de crédito: ${debt.productSummary}`,
        amountUSD: debt.amountUSD,
        remainingPendingUSD: newPending
      };

      const updatedDebts = prev.debts.map(c => {
        if (c.id === clientId) {
          return {
            ...c,
            debts: updatedClientDebts,
            totalPendingUSD: newPending,
            movements: [...(c.movements || []), newMovement]
          };
        }
        return c;
      });

      // Also mark associated sale as refunded
      const updatedSales = prev.sales.map(s => {
        if (s.id === debtId) {
          return { ...s, isRefunded: true };
        }
        return s;
      });

      return {
        ...prev,
        products: updatedProducts,
        debts: updatedDebts,
        sales: updatedSales
      };
    });
    alert('Crédito eliminado con éxito y productos devueltos al depósito.');
  };

  // Intelligent refund refunding stock to store
  const handleRefundSale = (saleId: string) => {
    setState(prev => {
      // Find sale
      const targetSale = prev.sales.find(s => s.id === saleId);
      if (!targetSale) return prev;

      // 1. Restore product inventory stock
      const updatedProducts = prev.products.map(product => {
        const refundItem = targetSale.items.find(item => item.productId === product.id);
        if (refundItem) {
          const nextStock = product.stock + refundItem.quantity;
          if (isSupabaseConfigured) {
            updateProductStockInSupabase(product.id, nextStock).catch(e => console.error('Error updating stock in Supabase:', e));
          }
          return {
            ...product,
            stock: nextStock
          };
        }
        return product;
      });

      // 2. Mark sale refunded
      const updatedSales = prev.sales.map(s => s.id === saleId ? { ...s, isRefunded: true } : s);

      // 3. Clear from debtors portfolio if credit sale
      const updatedDebts = prev.debts.map(client => {
        const debtIndex = client.debts.findIndex(d => d.id === saleId);
        if (debtIndex !== -1) {
          // Remove debt or mark paid/refunded
          const targetDebt = client.debts[debtIndex];
          const filteredDebts = client.debts.filter(d => d.id !== saleId);
          const newPending = filteredDebts
            .filter(d => !d.isPaid)
            .reduce((sum, d) => sum + d.remainingUSD, 0);

          const newMovement = {
            id: `move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: new Date().toISOString(),
            type: 'reembolso' as const,
            description: `Reembolso de compra: ${targetDebt.productSummary}`,
            amountUSD: targetDebt.amountUSD,
            remainingPendingUSD: newPending
          };

          return {
            ...client,
            debts: filteredDebts,
            totalPendingUSD: newPending,
            movements: [...(client.movements || []), newMovement]
          };
        }
        return client;
      }).filter(client => client.totalPendingUSD > 0 || (client.movements && client.movements.length > 0) || client.debts.length > 0); // retain clients with activity

      return {
        ...prev,
        products: updatedProducts,
        sales: updatedSales,
        debts: updatedDebts
      };
    });
  };

  // Helper counts for badges
  const cartCount = 0; // Handled internally in CajaPOS now
  const lowStockCount = state.products.filter(p => p.stock <= p.minStock).length;
  const pendingDebtsCount = state.debts.filter(c => c.totalPendingUSD > 0).length;

  if (isCatalogMode) {
    const products = urlCatalogData?.products || state.products;
    const exchangeRate = urlCatalogData?.exchangeRate || state.exchangeRate;
    const whatsappPhone = urlCatalogData?.whatsappPhone || state.whatsappPhone || '584120000000';

    return (
      <CatalogoCliente 
        products={products}
        exchangeRate={exchangeRate}
        whatsappPhone={whatsappPhone}
        onBackToAdmin={() => {
          setIsCatalogMode(false);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#faf5ff] text-slate-800 font-sans flex flex-col transition-all duration-300">
      
      {/* Top Controller Header Bar for AI Studio Previewers */}
      <header id="emulator-controls" className="w-full bg-white/95 backdrop-blur-md border-b border-violet-100 px-6 py-3 flex flex-wrap items-center justify-between gap-4 z-50 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-md animate-pulse">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-violet-950 tracking-tight flex items-center gap-1">
              EM TIENDA <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Ventas e Inventario</span>
            </h1>
          </div>
        </div>

        {/* Action controllers */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Catalog Share Button */}
          <button 
            id="copy-catalog-link-btn"
            onClick={async () => {
              const customUrl = localStorage.getItem('CUSTOM_SUPABASE_URL') || '';
              const customKey = localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') || '';
              let catalogUrl = window.location.origin + window.location.pathname + '?view=catalogo';
              
              if (isSupabaseConfigured) {
                if (customUrl && customKey) {
                  catalogUrl += `&sUrl=${encodeURIComponent(customUrl)}&sKey=${encodeURIComponent(customKey)}`;
                }
              } else {
                const catalogData = serializeCatalogData(state);
                catalogUrl += '&data=' + catalogData;
              }

              const template = state.catalogShareTemplate || DEFAULT_CATALOG_SHARE_TEMPLATE;
              const shareText = template.replace(/{catalog_url}/g, catalogUrl);

              // Highly robust copy to clipboard with fallback
              let copied = false;
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(shareText);
                  copied = true;
                }
              } catch (err) {
                console.warn('Clipboard API failed, trying fallback:', err);
              }

              if (!copied) {
                try {
                  const textArea = document.createElement('textarea');
                  textArea.value = shareText;
                  textArea.style.position = 'fixed';
                  textArea.style.top = '0';
                  textArea.style.left = '0';
                  textArea.style.opacity = '0';
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  copied = document.execCommand('copy');
                  document.body.removeChild(textArea);
                } catch (err) {
                  console.error('Fallback copy failed:', err);
                }
              }

              if (copied) {
                alert(`¡Mensaje del Catálogo copiado al portapapeles!\n\nYa puedes pegarlo directamente en WhatsApp para compartirlo con tus clientes:\n\n${shareText}`);
              } else {
                window.prompt('No se pudo copiar automáticamente debido a restricciones del navegador. Por favor copia el siguiente texto manualmente:', shareText);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-black transition-all shadow-xs"
            title="Copiar Enlace del Catálogo para Clientes"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Compartir Catálogo</span>
          </button>

          {/* Catalog Preview Button */}
          <button 
            id="preview-catalog-btn"
            onClick={() => {
              const customUrl = localStorage.getItem('CUSTOM_SUPABASE_URL') || '';
              const customKey = localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') || '';
              let catalogUrl = window.location.pathname + '?view=catalogo';
              
              if (isSupabaseConfigured) {
                if (customUrl && customKey) {
                  catalogUrl += `&sUrl=${encodeURIComponent(customUrl)}&sKey=${encodeURIComponent(customKey)}`;
                }
              } else {
                const catalogData = serializeCatalogData(state);
                catalogUrl += '&data=' + catalogData;
              }

              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', catalogUrl);
              }
              setIsCatalogMode(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-xl text-pink-800 text-xs font-black transition-all shadow-xs"
            title="Previsualizar Catálogo del Cliente en pantalla"
          >
            <ExternalLink className="w-3.5 h-3.5 text-pink-600 animate-pulse" />
            <span>Ver Catálogo (Probar)</span>
          </button>

          {/* Supabase Sync Badge */}
          <button
            id="supabase-sync-badge-btn"
            onClick={() => {
              setTempRate(state.exchangeRate.toString());
              setTempPhone(state.whatsappPhone || '584120000000');
              setSettingsTab('supabase');
              setIsSettingsOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-black transition-all shadow-xs ${
              syncStatus === 'synced'
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                : syncStatus === 'syncing'
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                : syncStatus === 'error'
                ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-800'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title={
              syncStatus === 'synced'
                ? `Sincronizado con Supabase. Tiempo real activo: ${isRealtimeActive ? 'Sí' : 'No'}`
                : syncStatus === 'syncing'
                ? 'Guardando cambios en Supabase...'
                : syncStatus === 'error'
                ? 'Error de sincronización con Supabase. Haz clic para ver detalles y reparar.'
                : 'Sincronización inactiva. Haz clic para conectar Supabase.'
            }
          >
            {syncStatus === 'synced' ? (
              <>
                <Cloud className={`w-3.5 h-3.5 text-emerald-600 ${isRealtimeActive ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">Nube Activa</span>
                <span className="sm:hidden">Nube</span>
              </>
            ) : syncStatus === 'syncing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                <span className="hidden sm:inline">Sincronizando...</span>
                <span className="sm:hidden">Sinc...</span>
              </>
            ) : syncStatus === 'error' ? (
              <>
                <CloudOff className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                <span className="hidden sm:inline">Error de Nube</span>
                <span className="sm:hidden">Error</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Solo Local</span>
                <span className="sm:hidden">Local</span>
              </>
            )}
          </button>


          {/* Rate Badge */}
          <button 
            id="open-settings-rate-btn"
            onClick={() => {
              setTempRate(state.exchangeRate.toString());
              setTempPhone(state.whatsappPhone || '584120000000');
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl text-violet-800 text-xs font-black transition-all"
            title="Configurar Tasa de Cambio y WhatsApp"
          >
            <Coins className="w-3.5 h-3.5 text-violet-600 animate-spin-slow" />
            <span>Tasa: {state.exchangeRate} Bs/$</span>
          </button>

          {/* Reset button */}
          <button
            id="reset-state-data-btn"
            onClick={handleResetData}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            title="Restablecer Datos de Fábrica"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

        </div>
      </header>

      {/* Main Workspace Frame container */}
      <div id="emulator-workspace" className="flex-1 flex items-center justify-center p-4 md:p-8">
        
        {/* Main Application Container */}
        <div id="main-app-container" className="w-full max-w-[460px] md:max-w-6xl h-[750px] md:h-[85vh] md:min-h-[650px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative flex flex-col pb-16">
          
          <div className="flex-1 bg-slate-50 overflow-hidden relative flex flex-col">
            {activeTab === 'caja' && (
              <CajaPOS 
                products={state.products}
                exchangeRate={state.exchangeRate}
                onCompleteSale={handleCompleteSale}
                onOpenAddProductModal={() => { setActiveTab('deposito'); setIsOpenAddModal(true); }}
              />
            )}
            {activeTab === 'deposito' && (
              <Deposito 
                products={state.products}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                isOpenAddModal={isOpenAddModal}
                setIsOpenAddModal={setIsOpenAddModal}
              />
            )}
            {activeTab === 'metricas' && (
              <Metricas 
                sales={state.sales}
                exchangeRate={state.exchangeRate}
              />
            )}
            {activeTab === 'historial' && (
              <Historial 
                sales={state.sales}
                exchangeRate={state.exchangeRate}
                onRefundSale={handleRefundSale}
              />
            )}
            {activeTab === 'fiados' && (
              <Fiados 
                debts={state.debts}
                exchangeRate={state.exchangeRate}
                onRegisterAbono={handleRegisterAbono}
                onAddClientDebtor={handleAddClientDebtor}
                onUpdateClientPhone={handleUpdateClientPhone}
                onDeleteClient={handleDeleteClient}
                onDeleteClientDebt={handleDeleteClientDebt}
                debtReminderTemplate={state.debtReminderTemplate}
              />
            )}

            {/* Bottom Navigation */}
            <BottomNav 
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              cartCount={cartCount}
              lowStockCount={lowStockCount}
              pendingDebtsCount={pendingDebtsCount}
            />
          </div>

        </div>

      </div>

      {/* Global Config Settings Modal (Tasa, WhatsApp y Supabase) */}
      {isSettingsOpen && (
        <div id="settings-rate-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-[440px] p-6 shadow-2xl animate-fadeIn max-h-[90vh] flex flex-col">
            
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-violet-600" />
                Configuración del Sistema
              </h3>
              <button 
                onClick={() => {
                  setIsSettingsOpen(false);
                  setSettingsTab('general'); // Reset tab on close
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            {/* Tab Controller Switcher */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setSettingsTab('general')}
                className={`py-2 text-[9px] font-black rounded-lg transition-all ${
                  settingsTab === 'general' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Parámetros
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('templates')}
                className={`py-2 text-[9px] font-black rounded-lg transition-all flex items-center justify-center gap-1 ${
                  settingsTab === 'templates' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageCircle className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                Plantillas WA
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('supabase')}
                className={`py-2 text-[9px] font-black rounded-lg transition-all flex items-center justify-center gap-1 ${
                  settingsTab === 'supabase' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Cloud className={`w-2.5 h-2.5 ${syncStatus === 'synced' ? 'text-emerald-500' : 'text-slate-400'} shrink-0`} />
                Sincronización
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              
              {settingsTab === 'general' ? (
                <form onSubmit={handleSaveRate} className="space-y-4">
                  <div className="p-3.5 bg-violet-50 border border-violet-100 rounded-2xl text-xs text-violet-800 space-y-1">
                    <p className="font-bold">¿Cómo influye la tasa de cambio?</p>
                    <p className="leading-relaxed text-[11px]">
                      Todos los precios de venta y cobros se calculan en dólares ($) y se convierten en tiempo real a Bolívares (Bs.) basándose en este valor configurado.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Tasa actual del dólar (Bs/USD)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-extrabold">Bs.</span>
                      <input 
                        type="number" 
                        step="any"
                        min="0.1"
                        required
                        value={tempRate}
                        onChange={(e) => setTempRate(e.target.value)}
                        className="w-full text-sm font-black pl-11 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp de la Tienda (para recibir pedidos)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-extrabold">+</span>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej. 584120000000"
                        value={tempPhone}
                        onChange={(e) => setTempPhone(e.target.value)}
                        className="w-full text-xs font-black pl-7 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Código de país + número (ej. 584125555555 para Venezuela) sin espacios ni símbolos.</p>
                  </div>

                  {/* Submit / Save CTA */}
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </button>
                </form>
              ) : settingsTab === 'templates' ? (
                <form onSubmit={handleSaveTemplates} className="space-y-4 text-xs">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800 space-y-1">
                    <p className="font-bold text-emerald-950">Personaliza tus Mensajes</p>
                    <p className="leading-relaxed text-[10px] text-emerald-900">
                      Personaliza las plantillas que usa la app al compartir tu catálogo de productos o al enviar un recordatorio de deuda a tus clientes.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Mensaje para Compartir Catálogo
                    </label>
                    <textarea
                      rows={4}
                      value={tempCatalogTemplate}
                      onChange={(e) => setTempCatalogTemplate(e.target.value)}
                      className="w-full text-xs font-medium p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500 leading-relaxed font-sans"
                      placeholder="Escribe el mensaje..."
                      required
                    />
                    <p className="text-[9px] text-slate-400 mt-1">
                      Usa <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono font-bold text-[8px]">{'{catalog_url}'}</code> para indicar dónde se incluirá el enlace del catálogo.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Mensaje de Cobro de Fiados
                    </label>
                    <textarea
                      rows={6}
                      value={tempDebtTemplate}
                      onChange={(e) => setTempDebtTemplate(e.target.value)}
                      className="w-full text-xs font-medium p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500 leading-relaxed font-sans"
                      placeholder="Escribe el mensaje..."
                      required
                    />
                    <div className="text-[9px] text-slate-400 mt-1 space-y-1 bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                      <p className="font-bold text-slate-600">Variables dinámicas disponibles:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[8.5px]">
                        <li><code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono font-bold">{'{client_name}'}</code>: Nombre del cliente</li>
                        <li><code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono font-bold">{'{pending_usd}'}</code>: Saldo total en USD</li>
                        <li><code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono font-bold">{'{pending_bs}'}</code>: Saldo convertido a Bs.</li>
                        <li><code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono font-bold">{'{unpaid_debts_text}'}</code>: Detalle de deudas</li>
                      </ul>
                    </div>
                  </div>

                  {/* Reset Templates Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('¿Estás seguro de que deseas restablecer ambas plantillas a los mensajes predeterminados de la app?')) {
                          setTempCatalogTemplate(DEFAULT_CATALOG_SHARE_TEMPLATE);
                          setTempDebtTemplate(DEFAULT_DEBT_REMINDER_TEMPLATE);
                        }
                      }}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl font-bold text-[10px] transition-all"
                    >
                      Restablecer Mensajes Predeterminados
                    </button>
                  </div>

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Guardar Plantillas</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-xs">
                  
                  {/* Sync Status Banner */}
                  <div className={`p-4 rounded-2xl border ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-50 border-amber-100 text-amber-800'
                      : syncStatus === 'error'
                      ? 'bg-red-50 border-red-100 text-red-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {syncStatus === 'synced' ? (
                        <Cloud className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : syncStatus === 'syncing' ? (
                        <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
                      ) : (
                        <CloudOff className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-black text-xs">
                          {syncStatus === 'synced' && '¡Conexión Activa con Supabase!'}
                          {syncStatus === 'syncing' && 'Sincronizando con la Nube...'}
                          {syncStatus === 'error' && 'Error de Conexión'}
                          {syncStatus === 'not-configured' && 'Sincronización Desactivada'}
                        </p>
                        <p className="text-[10px] opacity-90 leading-relaxed mt-1">
                          {syncStatus === 'synced' && 'Tus datos están guardados de forma segura en la base de datos Postgres de Supabase. Cualquier cambio en otros dispositivos se reflejará en tiempo real aquí.'}
                          {syncStatus === 'syncing' && 'Guardando o cargando datos del inventario...'}
                          {syncStatus === 'error' && (
                            <span className="block">
                              Hubo un error al guardar o recuperar datos. Verifica tus credenciales de Supabase o la estructura de la base de datos.
                              {syncError && (
                                <span className="block font-mono bg-red-100/80 text-red-900 px-2 py-1.5 rounded-lg text-[9px] mt-1.5 select-all border border-red-200">
                                  Detalle técnico: {syncError}
                                </span>
                              )}
                            </span>
                          )}
                          {syncStatus === 'not-configured' && 'Actualmente la app funciona de forma local en este navegador (LocalStorage). Si borras la caché o abres la app en otro celular, no verás los mismos datos.'}
                        </p>
                        {lastCloudUpdate && (
                          <p className="text-[9px] opacity-75 font-mono mt-2">
                            Última sincronización: {new Date(lastCloudUpdate).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Environment Config Info Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <h4 className="font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                      <Sliders className="w-3.5 h-3.5 text-violet-600" />
                      Configuración de Credenciales
                    </h4>
                    
                    {isConfiguredViaEnv ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2 border border-emerald-100 rounded-xl leading-relaxed">
                          ✓ <strong>Conectado por el Sistema:</strong> Las variables de entorno están correctamente configuradas en tu servidor de Google AI Studio.
                        </p>
                        <div className="space-y-1.5 font-mono text-[10px] bg-white p-2.5 border border-slate-100 rounded-xl">
                          <div className="flex justify-between">
                            <span className="text-violet-700 font-bold">VITE_SUPABASE_URL</span>
                            <span className="text-emerald-600 font-bold">Configurado</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-50 pt-1.5">
                            <span className="text-violet-700 font-bold">VITE_SUPABASE_ANON_KEY</span>
                            <span className="text-emerald-600 font-bold">Configurado</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-left">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          La aplicación no tiene variables de entorno configuradas por defecto en el servidor. <strong>¡No te preocupes!</strong> Puedes pegar tus credenciales de Supabase aquí abajo para conectar y sincronizar tu tienda en este dispositivo:
                        </p>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">SUPABASE URL</label>
                            <input
                              type="text"
                              placeholder="https://xxxx.supabase.co"
                              value={manualUrl}
                              onChange={(e) => setManualUrl(e.target.value)}
                              className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-1 focus:ring-violet-500"
                            />
                          </div>
                          
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-1">SUPABASE ANON KEY</label>
                            <textarea
                              placeholder="eyJhbGciOi..."
                              value={manualKey}
                              onChange={(e) => setManualKey(e.target.value)}
                              rows={2}
                              className="w-full text-[10px] font-mono px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-1 focus:ring-violet-500 leading-relaxed"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!manualUrl.trim() || !manualKey.trim()) {
                                alert('Por favor, ingresa tanto la URL como la Anon Key de Supabase.');
                                return;
                              }
                              saveCustomCredentials(manualUrl, manualKey);
                              alert('¡Credenciales guardadas con éxito! La página se recargará para conectar la base de datos.');
                              window.location.reload();
                            }}
                            className="flex-1 py-2 bg-violet-600 hover:bg-violet-750 text-white rounded-xl font-bold text-xs shadow-xs transition-all text-center"
                          >
                            Conectar Base de Datos
                          </button>
                          
                          {(localStorage.getItem('CUSTOM_SUPABASE_URL') || localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY')) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('¿Deseas desconectar y borrar las credenciales guardadas en este dispositivo?')) {
                                  clearCustomCredentials();
                                  setManualUrl('');
                                  setManualKey('');
                                  alert('Credenciales borradas. La página se recargará.');
                                  window.location.reload();
                                }
                              }}
                              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs transition-all"
                              title="Borrar credenciales manuales"
                            >
                              Desconectar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SQL Setup block */}
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-violet-950 uppercase tracking-wider text-[10px]">
                        Código SQL para Supabase
                      </h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
                          setSqlCopied(true);
                          setTimeout(() => setSqlCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[10px] font-bold transition-all"
                      >
                        {sqlCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar SQL</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    <p className="text-[11px] text-violet-900 leading-relaxed">
                      Entra al panel de tu proyecto en <strong className="font-extrabold text-violet-950">Supabase</strong>, abre el menú <strong>SQL Editor</strong>, haz clic en <strong>New Query</strong>, pega el código que copiarás con el botón de arriba, y haz clic en <strong>Run</strong>:
                    </p>

                    <pre className="text-[9px] bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-x-auto max-h-32 font-mono scrollbar-none leading-relaxed">
                      {SUPABASE_SQL_SETUP}
                    </pre>
                  </div>

                </div>
              )}

            </div>

          </div>
        </div>
      )}


      {/* Elegant minimalist footer */}
      <footer className="w-full bg-white border-t border-violet-100 py-4 text-center text-xs text-slate-400 mt-auto flex flex-col sm:flex-row items-center justify-between px-6 gap-2">
        <div className="flex items-center gap-1.5 font-medium text-slate-500">
          <CheckCircle className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span>"EM TIENDA" offline-first local storage sincronizado</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          Powered by React 19 + Tailwind CSS v4 + @google/genai
        </div>
      </footer>

    </div>
  );
}
