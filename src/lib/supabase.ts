import { createClient } from '@supabase/supabase-js';
import { AppState, Product } from '../types';

// Read public client-side env variables
const env = (import.meta as any).env || {};

export function cleanEnvValue(value: any): string {
  if (typeof value !== 'string') return '';
  // Remove zero-width spaces or invisible characters
  let cleaned = value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  
  // If the user pasted the entire line like "VITE_SUPABASE_ANON_KEY = ...", extract the value after '='
  if (cleaned.includes('=')) {
    const parts = cleaned.split('=');
    cleaned = parts.slice(1).join('=').trim();
  }
  
  // Strip enclosing quotes (double or single)
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export function cleanUrl(value: any): string {
  let cleaned = cleanEnvValue(value);
  if (!cleaned) return '';
  
  // Strip zero-width spaces
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  // 1. If user pasted a Supabase dashboard URL, e.g. https://supabase.com/dashboard/project/abcdefghijklmnopqrstuvwxyz
  const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // 2. If user pasted a subdomain like https://abcdef.supaba... or abcdef.supabase... (with any typos in supabase or missing .co)
  const subdomainMatch = cleaned.match(/^(?:https?:\/\/)?([a-z0-9_-]+)\.(?:supa[a-z]*|supabase)(?:\.co)?(?:\/.*)?$/i);
  if (subdomainMatch && subdomainMatch[1]) {
    return `https://${subdomainMatch[1]}.supabase.co`;
  }

  // 3. If the user just pasted the project reference (15-35 alphanumeric chars)
  const isOnlyAlphanumeric = /^[a-z0-9_-]{15,35}$/i.test(cleaned);
  if (isOnlyAlphanumeric) {
    return `https://${cleaned}.supabase.co`;
  }
  
  // 4. Strip trailing slashes or subpaths like /rest/v1
  if (cleaned.includes('/rest/v1')) {
    cleaned = cleaned.split('/rest/v1')[0];
  }
  
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  
  // 5. Auto-correct incomplete domain endings like .supabas, .supaba, .supa, .supabase
  cleaned = cleaned.replace(/\.(supabase|supabas|supaba|supa|sup)(?:\.co)?$/i, '.supabase.co');

  // Handle case where user missed '.co' at the end of '.supabase.co'
  if (cleaned.endsWith('.supabase')) {
    cleaned = cleaned + '.co';
  }
  
  // Ensure protocol is present
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  
  return cleaned;
}

let searchUrl = '';
let searchKey = '';
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const sUrl = params.get('sUrl');
    const sKey = params.get('sKey');
    if (sUrl && sKey) {
      searchUrl = sUrl;
      searchKey = sKey;
      localStorage.setItem('CUSTOM_SUPABASE_URL', sUrl);
      localStorage.setItem('CUSTOM_SUPABASE_ANON_KEY', sKey);
    }
  } catch (err) {
    console.error('Error parsing sUrl or sKey from window.location', err);
  }
}

const rawUrl = env.VITE_SUPABASE_URL || searchUrl || (typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_SUPABASE_URL') : '');
const rawKey = env.VITE_SUPABASE_ANON_KEY || searchKey || (typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') : '');

const supabaseUrl = cleanUrl(rawUrl);
const supabaseAnonKey = cleanEnvValue(rawKey);

// Auto-heal localStorage if the saved URL was malformed (e.g. ended in .supabas)
if (typeof window !== 'undefined' && supabaseUrl && rawUrl && supabaseUrl !== rawUrl) {
  try {
    localStorage.setItem('CUSTOM_SUPABASE_URL', supabaseUrl);
    console.log('[Supabase Sync] Repaired malformed Supabase URL in localStorage:', supabaseUrl);
  } catch (e) {}
}

export const isConfiguredViaEnv = Boolean(
  env.VITE_SUPABASE_URL && 
  env.VITE_SUPABASE_ANON_KEY && 
  !env.VITE_SUPABASE_URL.includes('your-supabase-project') && 
  !env.VITE_SUPABASE_ANON_KEY.includes('your-supabase-anon-key')
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-supabase-project') && 
  !supabaseAnonKey.includes('your-supabase-anon-key') &&
  supabaseUrl.includes('.')
);

export function saveCustomCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    const cleanedUrl = cleanUrl(url);
    const cleanedKey = cleanEnvValue(key);
    localStorage.setItem('CUSTOM_SUPABASE_URL', cleanedUrl);
    localStorage.setItem('CUSTOM_SUPABASE_ANON_KEY', cleanedKey);
  }
}

export function clearCustomCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('CUSTOM_SUPABASE_URL');
    localStorage.removeItem('CUSTOM_SUPABASE_ANON_KEY');
  }
}

export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<{
  success: boolean;
  status: 'ok' | 'auth_error' | 'network_error' | 'tables_missing' | 'invalid_url';
  message: string;
  cleanedUrl: string;
}> {
  const cleanedUrl = cleanUrl(url);
  const cleanedKey = cleanEnvValue(key);

  if (!cleanedUrl || !cleanedUrl.includes('.') || !cleanedUrl.startsWith('http')) {
    return {
      success: false,
      status: 'invalid_url',
      message: 'La URL no es válida. Debe tener el formato: https://[tu-proyecto].supabase.co',
      cleanedUrl
    };
  }

  if (!cleanedKey) {
    return {
      success: false,
      status: 'auth_error',
      message: 'Por favor ingresa la Anon Key o Publishable Key de Supabase.',
      cleanedUrl
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${cleanedUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: cleanedKey,
        Authorization: `Bearer ${cleanedKey}`
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        status: 'auth_error',
        message: 'Clave no válida (Error 401/403). La Anon Key / Publishable Key ingresada no corresponde a este proyecto.',
        cleanedUrl
      };
    }

    // Check if tables exist
    const testClient = createClient(cleanedUrl, cleanedKey);
    const { error: prodError } = await testClient.from('productos').select('id').limit(1);

    if (prodError && (prodError.code === '42P01' || prodError.message?.toLowerCase().includes('does not exist') || prodError.message?.toLowerCase().includes('not find'))) {
      return {
        success: true,
        status: 'tables_missing',
        message: '¡Servidor de Supabase alcanzado con éxito! Sin embargo, aún no has creado las tablas en tu base de datos. Copia y ejecuta el código SQL que está abajo.',
        cleanedUrl
      };
    }

    return {
      success: true,
      status: 'ok',
      message: '¡Conexión exitosa! Las credenciales y la base de datos están listas para sincronizar.',
      cleanedUrl
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return {
      success: false,
      status: 'network_error',
      message: `Error de conexión (${msg}). Posibles causas: 1) El ID del proyecto no existe o tiene un error de tipeo. 2) El proyecto en Supabase está 'Paused' (en pausa por inactividad). 3) Problema de internet o DNS.`,
      cleanedUrl
    };
  }
}

// Secure debug log for the user to confirm their credentials in the browser DevTools console
console.log('[Supabase Client Sync] Init Info:', {
  configured: isSupabaseConfigured,
  configuredViaEnv: isConfiguredViaEnv,
  urlLength: supabaseUrl ? supabaseUrl.length : 0,
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
  urlMasked: supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/)?([^\.]{3})[^\/]+/, '$1$2***') : 'none'
});

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const SYNC_ROW_ID = 'main_inventory_state';

/**
 * Loads the application state from Supabase.
 * If no record exists, it returns null.
 */
export async function loadStateFromSupabase(): Promise<{ state: AppState; updatedAt: string } | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('em_tienda_sync')
      .select('state, updated_at')
      .eq('id', SYNC_ROW_ID)
      .maybeSingle();

    if (error) {
      const status = (error as any).status;
      const isNetworkOrAuth = error.message?.includes('fetch') || error.message?.includes('network') || status === 401 || status === 403;
      if (isNetworkOrAuth) {
        console.warn('[Supabase Sync Warning] Failed to fetch state (Auth/Network):', error.message);
      } else {
        console.warn('[Supabase Sync Warning] Error fetching state from Supabase:', error.message);
      }
      throw error;
    }

    if (data) {
      return {
        state: data.state as AppState,
        updatedAt: data.updated_at
      };
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const isNetworkOrAuth = errMsg.includes('fetch') || errMsg.includes('Network') || errMsg.includes('Failed to fetch') || errMsg.includes('network');
    
    if (isNetworkOrAuth) {
      console.warn('[Supabase Sync Warning] Connection issue during load:', errMsg);
    } else {
      console.warn('[Supabase Sync Warning] Exception while loading Supabase state:', errMsg);
    }
  }

  return null;
}

/**
 * Saves the application state to Supabase.
 */
export async function saveStateToSupabase(state: AppState): Promise<string | null> {
  if (!supabase) return null;

  try {
    const timestamp = new Date().toISOString();
    // Keep the full state (including products) in the JSON blob as a robust fallback to ensure no products are ever lost
    
    const { error } = await supabase
      .from('em_tienda_sync')
      .upsert({
        id: SYNC_ROW_ID,
        state: state,
        updated_at: timestamp
      });

    if (error) {
      const status = (error as any).status;
      const isNetworkOrAuth = error.message?.includes('fetch') || error.message?.includes('network') || status === 401 || status === 403;
      if (isNetworkOrAuth) {
        console.warn('[Supabase Sync Warning] Failed to save state (Auth/Network):', error.message);
      } else {
        console.warn('[Supabase Sync Warning] Failed to save state:', error.message);
      }
      throw error;
    }

    return timestamp;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const isNetworkOrAuth = errMsg.includes('fetch') || errMsg.includes('Network') || errMsg.includes('Failed to fetch') || errMsg.includes('network');
    
    if (isNetworkOrAuth) {
      console.warn('[Supabase Sync Warning] Connection issue during save:', errMsg);
    } else {
      console.warn('[Supabase Sync Warning] Exception during save:', errMsg);
    }
    throw err;
  }
}

// --- Product Mapper and DB Operations ---

export function mapRowToProduct(row: any): Product {
  return {
    id: row.id || '',
    name: row.nombre || '',
    sku: row.codigo_barra || '',
    price: Number(row.precio) || 0,
    cost: Number(row.costo) || 0,
    profitPercent: Number(row.ganancia_porcentaje) || 0,
    stock: Number(row.stock) || 0,
    minStock: 0,
    category: row.categoria || 'Otros',
    image: row.imagen_url || ''
  };
}

export function mapProductToRow(product: Product) {
  return {
    id: product.id,
    nombre: product.name,
    codigo_barra: product.sku || '',
    precio: product.price,
    costo: product.cost || 0,
    ganancia_porcentaje: product.profitPercent || 0,
    stock: product.stock,
    categoria: product.category,
    imagen_url: product.image || ''
  };
}

export async function fetchProductsFromSupabase(): Promise<Product[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });
      
    if (error) {
      // If the table doesn't exist yet, return null gracefully so we can fall back
      console.warn('[Supabase Productos Fetch Warning] Error fetching products:', error.message);
      return null;
    }
    if (data) {
      return data.map(mapRowToProduct);
    }
  } catch (err) {
    console.warn('[Supabase Productos Fetch Exception] Failed:', err);
  }
  return null;
}

export async function saveProductToSupabase(product: Product, isInsert = false): Promise<boolean> {
  if (!supabase) return false;
  try {
    const row = mapProductToRow(product);
    if (isInsert) {
      const { error } = await supabase
        .from('productos')
        .insert(row);
        
      if (error) {
        console.warn('[Supabase Productos Insert Warning] Error inserting product:', error.message);
        // Fallback to upsert in case it was a re-run of a save
        const { error: upsertError } = await supabase
          .from('productos')
          .upsert(row);
        return !upsertError;
      }
      return true;
    } else {
      const { error } = await supabase
        .from('productos')
        .upsert(row);
        
      if (error) {
        console.warn('[Supabase Productos Save Warning] Error saving product:', error.message);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.warn('[Supabase Productos Save Exception] Failed:', err);
    return false;
  }
}

export async function deleteProductFromSupabase(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.warn('[Supabase Productos Delete Warning] Error deleting product:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Productos Delete Exception] Failed:', err);
    return false;
  }
}

export async function updateProductStockInSupabase(id: string, newStock: number): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('productos')
      .update({ stock: newStock })
      .eq('id', id);
      
    if (error) {
      console.warn('[Supabase Stock Update Warning] Error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Stock Update Exception] Failed:', err);
    return false;
  }
}

/**
 * SQL instructions to create the necessary table in Supabase.
 */
export const SUPABASE_SQL_SETUP = `-- 1. Crea la tabla de productos directos
create table if not exists productos (
  id text primary key,
  nombre text not null,
  stock numeric not null default 0,
  precio numeric not null default 0,
  costo numeric not null default 0,
  ganancia_porcentaje numeric not null default 0,
  categoria text not null default 'Otros',
  codigo_barra text,
  imagen_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilita RLS en la tabla productos
alter table productos enable row level security;

-- 3. Crea políticas RLS públicas (anon y authenticated) para que la vista previa funcione
drop policy if exists "Permitir select público" on productos;
create policy "Permitir select público"
on productos for select
using (true);

drop policy if exists "Permitir insert público" on productos;
create policy "Permitir insert público"
on productos for insert
with check (true);

drop policy if exists "Permitir update público" on productos;
create policy "Permitir update público"
on productos for update
using (true)
with check (true);

drop policy if exists "Permitir delete público" on productos;
create policy "Permitir delete público"
on productos for delete
using (true);

-- 4. Opcional: Crea la tabla de sincronización del estado para otras variables
create table if not exists em_tienda_sync (
  id text primary key,
  state jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table em_tienda_sync disable row level security;

-- 5. Habilita réplica en tiempo real (Realtime) para la tabla productos de forma segura
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'productos'
  ) then
    alter publication supabase_realtime add table productos;
  end if;
end $$;`;
