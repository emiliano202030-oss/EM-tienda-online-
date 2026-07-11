/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number; // Sale price in USD
  cost: number;  // Cost price in USD
  profitPercent: number; // Calculated automatically
  stock: number;
  minStock: number;
  category: 'Maquillaje' | 'Cuidado de la piel' | 'Cabello' | 'Hogar' | 'Juguetes para Adultos' | 'Protector Solar' | 'Fajas' | 'Calzado' | 'Brochas y Borlas' | 'Tecnología' | 'Accesorios' | 'Bolsos y carteras' | 'Bolsas y cajas de regalo' | 'Otros';
  image: string; // Base64 or placeholder URL
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  date: string; // ISO String
  items: SaleItem[];
  totalUSD: number;
  totalBs: number;
  paymentMethod: 'Divisa' | 'Efectivo' | 'Punto' | 'Pago Móvil' | 'Crédito';
  clientName?: string; // If Crédito
  clientPhone?: string; // If Crédito
  amountPaidUSD: number;
  changeUSD: number;
  exchangeRate: number; // rate USD to Bs
  isRefunded?: boolean;
}

export interface DebtItem {
  id: string; // matches saleId
  date: string;
  productSummary: string;
  amountUSD: number;
  remainingUSD: number;
  isPaid: boolean;
}

export interface ClientMovement {
  id: string;
  date: string; // ISO String
  type: 'registro' | 'compra' | 'abono' | 'reembolso';
  description: string;
  amountUSD: number;
  remainingPendingUSD: number;
}

export interface ClientDebt {
  id: string;
  clientName: string;
  phone: string;
  debts: DebtItem[];
  totalPendingUSD: number;
  movements?: ClientMovement[];
}

export interface AppState {
  products: Product[];
  sales: Sale[];
  debts: ClientDebt[];
  exchangeRate: number; // Configurable rate e.g. 36.5 or similar
  whatsappPhone?: string; // Customizable shop WhatsApp phone number
  catalogShareTemplate?: string; // Customizable catalog share template
  debtReminderTemplate?: string; // Customizable debt reminder template
  updatedAt?: string; // ISO String for synchronization conflicts resolution
}
