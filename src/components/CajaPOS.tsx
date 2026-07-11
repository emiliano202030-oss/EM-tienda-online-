/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Coins, 
  DollarSign, 
  Smartphone, 
  CreditCard, 
  User, 
  Calculator, 
  AlertCircle,
  Scan,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  QrCode,
  Camera,
  Check
} from 'lucide-react';
import { Product, CartItem, Sale } from '../types';

interface CajaPOSProps {
  products: Product[];
  exchangeRate: number;
  onCompleteSale: (sale: Sale, cart: CartItem[]) => void;
  onOpenAddProductModal: () => void;
}

export default function CajaPOS({ products, exchangeRate, onCompleteSale, onOpenAddProductModal }: CajaPOSProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | 'Maquillaje' | 'Cuidado de la piel' | 'Cabello' | 'Hogar' | 'Juguetes para Adultos' | 'Protector Solar' | 'Fajas' | 'Calzado' | 'Brochas y Borlas' | 'Tecnología' | 'Accesorios' | 'Bolsos y carteras' | 'Bolsas y cajas de regalo' | 'Otros'>('Todos');
  const [viewStyle, setViewStyle] = useState<'Todos' | 'Juntos' | 'Separados'>('Todos'); // Custom visual grouping requested
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Divisa' | 'Efectivo' | 'Punto' | 'Pago Móvil' | 'Crédito'>('Divisa');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paidCurrency, setPaidCurrency] = useState<'USD' | 'Bs'>('USD');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // QR Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [qrScanSuccessToast, setQrScanSuccessToast] = useState<string | null>(null);
  const [manualSkuInput, setManualSkuInput] = useState('');

  // Categories list
  const categories = ['Todos', 'Maquillaje', 'Cuidado de la piel', 'Cabello', 'Hogar', 'Juguetes para Adultos', 'Protector Solar', 'Fajas', 'Calzado', 'Brochas y Borlas', 'Tecnología', 'Accesorios', 'Bolsos y carteras', 'Bolsas y cajas de regalo', 'Otros'] as const;

  // Filter products based on search query, category, and custom modular viewStyle
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const productName = product.name || '';
      const productSku = product.sku || '';
      const matchesSearch = productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            productSku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
      
      // Let's implement viewStyle visual segregation as specified by user:
      // "Todos", "Juntos" (only high stock products >= 5), "Separados" (low stock products < 5)
      if (viewStyle === 'Juntos') {
        return matchesSearch && matchesCategory && product.stock >= 5;
      }
      if (viewStyle === 'Separados') {
        return matchesSearch && matchesCategory && product.stock < 5;
      }
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, viewStyle]);

  // Handle Scan Simulator
  const handleScanSimulator = () => {
    setIsScannerOpen(true);
  };

  const handleSimulateQrScan = (product: Product) => {
    if (product.stock <= 0) {
      alert(`¡Lo sentimos! "${product.name}" no tiene stock disponible.`);
      return;
    }
    
    addToCart(product);
    setQrScanSuccessToast(`¡QR Escaneado con éxito! ${product.name} (+1)`);
    
    setTimeout(() => {
      setQrScanSuccessToast(null);
    }, 1500);
  };

  const handleManualSkuScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSku = manualSkuInput.trim();
    if (!cleanSku) return;

    const matchedProduct = products.find(p => {
      const pSku = p.sku || '';
      const pId = p.id || '';
      return pSku.toLowerCase() === cleanSku.toLowerCase() || pId.toLowerCase() === cleanSku.toLowerCase();
    });
    if (matchedProduct) {
      handleSimulateQrScan(matchedProduct);
      setManualSkuInput('');
    } else {
      alert(`No se encontró ningún producto con el código SKU o QR "${cleanSku}" en el depósito.`);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('¡Lo sentimos! Este producto no tiene stock disponible.');
      return;
    }
    
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Solo quedan ${product.stock} unidades de este producto.`);
          return prevCart;
        }
        return prevCart.map((item) => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          const originalProduct = products.find(p => p.id === productId);
          if (newQty <= 0) return null;
          if (originalProduct && newQty > originalProduct.stock) {
            alert(`Solo quedan ${originalProduct.stock} unidades de este producto.`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  // Cart stats
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const totalUSD = cartSubtotal;
  const totalBs = useMemo(() => {
    return totalUSD * exchangeRate;
  }, [totalUSD, exchangeRate]);

  // Change Calculator logic
  const numericPaidAmount = parseFloat(paidAmount) || 0;
  const convertedPaidUSD = useMemo(() => {
    if (paidCurrency === 'USD') return numericPaidAmount;
    return numericPaidAmount / exchangeRate;
  }, [numericPaidAmount, paidCurrency, exchangeRate]);

  const changeUSD = useMemo(() => {
    if (convertedPaidUSD <= totalUSD) return 0;
    return convertedPaidUSD - totalUSD;
  }, [convertedPaidUSD, totalUSD]);

  const changeBs = useMemo(() => {
    return changeUSD * exchangeRate;
  }, [changeUSD, exchangeRate]);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod === 'Crédito' && !clientName.trim()) {
      alert('Por favor ingrese el nombre del cliente para registrar la venta a crédito.');
      return;
    }

    // Prepare Sale Object
    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      date: new Date().toISOString(),
      items: cart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        cost: item.product.cost,
        quantity: item.quantity,
        subtotal: item.product.price * item.quantity,
      })),
      totalUSD,
      totalBs,
      paymentMethod,
      clientName: paymentMethod === 'Crédito' ? clientName.trim() : undefined,
      clientPhone: paymentMethod === 'Crédito' ? (clientPhone.trim() || 'N/A') : undefined,
      amountPaidUSD: paymentMethod === 'Crédito' ? 0 : convertedPaidUSD,
      changeUSD: paymentMethod === 'Crédito' ? 0 : changeUSD,
      exchangeRate,
    };

    onCompleteSale(newSale, cart);
    
    // Reset Cart & Modal
    setCart([]);
    setIsCheckoutOpen(false);
    setPaidAmount('');
    setClientName('');
    setClientPhone('');
    alert('¡Venta registrada con éxito!');
  };

  return (
    <div id="caja-pos-container" className="flex flex-col h-full bg-slate-50">
      
      {/* Top Banner & Header info */}
      <div className="bg-white p-4 border-b border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-violet-950 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-violet-600" />
            Caja Registradora
          </h2>
          <p className="text-xs text-slate-500">Tasa de Cambio: <strong className="text-violet-700">1 USD = {exchangeRate} Bs.</strong></p>
        </div>
        <div className="flex gap-1.5 bg-violet-100/60 p-1 rounded-lg border border-violet-200">
          {(['Todos', 'Juntos', 'Separados'] as const).map((style) => (
            <button
              key={style}
              onClick={() => setViewStyle(style)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                viewStyle === style 
                  ? 'bg-violet-600 text-white shadow-xs' 
                  : 'text-violet-700 hover:bg-violet-100'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Main interactive POS grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* Search Bar & Barcode Scanner Simulator Row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              id="pos-search-input"
              type="text"
              placeholder="Buscar por nombre o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all shadow-xs"
            />
          </div>
          <button 
            id="scanner-btn"
            onClick={handleScanSimulator}
            className={`px-3.5 py-2 border rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs font-bold shadow-xs ${
              isScannerOpen 
                ? 'bg-violet-100 text-violet-700 border-violet-300 animate-pulse' 
                : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
            }`}
          >
            <QrCode className="w-4 h-4 text-violet-600" />
            <span>Lector QR</span>
          </button>
        </div>

        {/* Category Horizontal Filter Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all border ${
                selectedCategory === cat 
                  ? 'bg-violet-600 text-white border-violet-600 shadow-xs' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const isLowStock = product.stock <= product.minStock;
              return (
                <div 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`bg-white rounded-2xl border p-2.5 flex flex-col justify-between transition-all duration-200 active:scale-95 cursor-pointer hover:shadow-md select-none group relative overflow-hidden ${
                    isLowStock 
                      ? 'border-amber-200 bg-amber-50/20 hover:border-amber-400' 
                      : 'border-slate-150 hover:border-violet-300'
                  }`}
                >
                  {/* Category Pill and Stock badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                      {product.category}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      product.stock === 0 
                        ? 'bg-red-100 text-red-600'
                        : isLowStock 
                        ? 'bg-amber-100 text-amber-700 font-extrabold' 
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {product.stock === 0 ? 'Agotado' : `Stock: ${product.stock}`}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div className="w-full aspect-square rounded-xl bg-slate-100 overflow-hidden mb-2 border border-slate-100">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Info details */}
                  <div className="mt-1">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-violet-950 transition-colors">
                      {product.name}
                    </h4>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-sm font-black text-violet-900">${product.price.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400">{(product.price * exchangeRate).toFixed(0)} Bs</span>
                    </div>
                  </div>

                  {/* Quick plus badge overlay */}
                  <div className="absolute bottom-12 right-4 w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm scale-90 group-hover:scale-100">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm text-slate-400">No se encontraron productos.</p>
              <button 
                onClick={onOpenAddProductModal}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-violet-100 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Producto
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Carrito Bar */}
      {cart.length > 0 && (
        <div id="floating-cart-bar" className="fixed bottom-16 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-slate-200/80 shadow-2xl p-4 rounded-t-3xl z-30 transition-transform animate-slideUp">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-black text-xs relative">
                <ShoppingCart className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-violet-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Tu Pedido</h4>
                <p className="text-[10px] text-slate-500">{cart.length} ítems en carrito</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-violet-950">${totalUSD.toFixed(2)}</span>
              <p className="text-[10px] text-slate-500">~ {totalBs.toFixed(0)} Bs.</p>
            </div>
          </div>

          {/* Mini cart items preview scrollable */}
          <div className="max-h-[140px] overflow-y-auto mb-3 space-y-1.5 border-t border-b border-slate-100 py-2">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between py-1 px-1 bg-slate-50 rounded-lg">
                <div className="flex-1 pr-2">
                  <p className="text-xs font-bold text-slate-800 line-clamp-1">{item.product.name}</p>
                  <p className="text-[10px] text-slate-400">${item.product.price.toFixed(2)} x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5">
                    <button 
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold px-1.5 text-slate-800">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Checkout CTA Button */}
          <button
            id="proceed-checkout-btn"
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-2 group transition-all"
          >
            <span>Ir a Pagar</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {/* Checkout Modal Frame */}
      {isCheckoutOpen && (
        <div id="checkout-modal" className="fixed inset-0 bg-slate-900/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl rounded-b-xl w-full max-w-[400px] p-6 shadow-2xl animate-slideUp overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Procesar Pago</h3>
                <p className="text-xs text-slate-500">Monto total a cobrar</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-violet-950">${totalUSD.toFixed(2)}</span>
                <p className="text-xs text-slate-500">{totalBs.toFixed(0)} Bs.</p>
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              
              {/* Payment Methods Grid */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Divisa', label: 'Divisa (USD)', icon: DollarSign },
                    { id: 'Efectivo', label: 'Efectivo (Bs)', icon: Coins },
                    { id: 'Punto', label: 'Punto de Venta', icon: CreditCard },
                    { id: 'Pago Móvil', label: 'Pago Móvil', icon: Smartphone },
                    { id: 'Crédito', label: 'A Crédito', icon: User }
                  ].map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method.id as any);
                          if (method.id === 'Crédito') {
                            setPaidAmount('0');
                          } else if (method.id === 'Divisa') {
                            setPaidCurrency('USD');
                            setPaidAmount(totalUSD.toFixed(2));
                          } else {
                            setPaidCurrency('Bs');
                            setPaidAmount(totalBs.toFixed(0));
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                          paymentMethod === method.id
                            ? 'border-violet-600 bg-violet-50 text-violet-950 ring-1 ring-violet-600'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${paymentMethod === method.id ? 'text-violet-600' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional: Credit (Fiados) Customer Form */}
              {paymentMethod === 'Crédito' ? (
                <div className="bg-violet-50/50 p-3 rounded-2xl border border-violet-100 space-y-3">
                  <div className="flex items-center gap-1.5 text-violet-800 text-xs font-bold">
                    <User className="w-4 h-4" />
                    <span>Datos del Cliente Deudor</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1 font-bold">Nombre Completo *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Valeria Gómez"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Teléfono Móvil (Opcional)</label>
                    <input 
                      type="tel" 
                      placeholder="+58 412-5551234"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
              ) : (
                /* Conditional: Change Calculator (Vuelto) */
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-violet-600" />
                      Calculadora de Vuelto
                    </span>
                    <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white">
                      {(['USD', 'Bs'] as const).map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => {
                            setPaidCurrency(curr);
                            setPaidAmount(curr === 'USD' ? totalUSD.toFixed(2) : totalBs.toFixed(0));
                          }}
                          className={`text-[10px] px-2.5 py-1 font-bold ${
                            paidCurrency === curr 
                              ? 'bg-violet-600 text-white' 
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1 font-bold">¿Con cuánto cancela el cliente? ({paidCurrency})</label>
                    <input 
                      type="number" 
                      step="any"
                      min={paidCurrency === 'USD' ? totalUSD : totalBs}
                      required
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full text-sm font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-400/50"
                    />
                  </div>

                  {numericPaidAmount > 0 && (
                    <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-center">
                      <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                        <span className="text-[10px] text-emerald-700 block font-bold">Vuelto en USD</span>
                        <span className="text-sm font-black text-emerald-700">${changeUSD.toFixed(2)}</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                        <span className="text-[10px] text-emerald-700 block font-bold">Vuelto en Bs.</span>
                        <span className="text-sm font-black text-emerald-700">{changeBs.toFixed(0)} Bs</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors"
                >
                  Confirmar Venta
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Interactive QR Camera Scanner Simulator Modal */}
      {isScannerOpen && (
        <div id="qr-camera-scanner-modal" className="fixed inset-0 bg-slate-900/80 flex items-end justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-[400px] p-5 shadow-2xl animate-slideUp flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-violet-600 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-wide">Cámara Lector QR</h3>
                  <p className="text-[10px] text-slate-400">Escaneo de productos instantáneo</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsScannerOpen(false);
                  setQrScanSuccessToast(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-black bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>

            {/* Scan camera view finder simulator */}
            <div className="aspect-[4/3] bg-slate-950 rounded-2xl border-2 border-violet-300 relative overflow-hidden flex flex-col items-center justify-center mb-4 shadow-inner shrink-0">
              
              {/* Pulsing red laser scan line */}
              <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse z-10" style={{
                top: '50%',
                animationDuration: '1.5s',
                animationIterationCount: 'infinite'
              }}></div>

              {/* Scanning targets brackets */}
              <div className="absolute top-8 left-8 w-8 h-8 border-t-4 border-l-4 border-violet-400 rounded-tl-md"></div>
              <div className="absolute top-8 right-8 w-8 h-8 border-t-4 border-r-4 border-violet-400 rounded-tr-md"></div>
              <div className="absolute bottom-8 left-8 w-8 h-8 border-b-4 border-l-4 border-violet-400 rounded-bl-md"></div>
              <div className="absolute bottom-8 right-8 w-8 h-8 border-b-4 border-r-4 border-violet-400 rounded-br-md"></div>

              {/* Success sound mock / success flash overlay */}
              {qrScanSuccessToast ? (
                <div className="absolute inset-0 bg-emerald-500/10 flex flex-col items-center justify-center text-white z-20 animate-fadeIn">
                  <div className="bg-emerald-500 text-white rounded-full p-3.5 mb-2 shadow-lg animate-bounce">
                    <Check className="w-8 h-8 text-white font-black animate-pulse" />
                  </div>
                  <span className="text-xs font-black bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-emerald-400 shadow-xl max-w-[80%] text-center">
                    {qrScanSuccessToast}
                  </span>
                </div>
              ) : (
                <div className="text-center text-slate-400 px-8 select-none">
                  <QrCode className="w-12 h-12 text-violet-500/80 mx-auto mb-2 animate-pulse" />
                  <p className="text-[11px] font-bold text-slate-300">Alinea el código QR del producto con el recuadro</p>
                  <p className="text-[9px] text-slate-500 mt-1">Soporta etiquetas de adhesivo y pantallas digitales</p>
                </div>
              )}
            </div>

            {/* Simulated product items for easy interactive test click */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block mb-1.5">Escanear QR de Producto Registrado</span>
                <div className="grid grid-cols-2 gap-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSimulateQrScan(p)}
                      className="p-2 border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 rounded-xl text-left flex items-center gap-2 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-slate-100">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-extrabold text-slate-800 truncate leading-tight group-hover:text-violet-950">{p.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">QR: {p.sku}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual SKU Scan Search form */}
              <form onSubmit={handleManualSkuScanSubmit} className="pt-2 border-t border-slate-100 shrink-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block mb-1">Escanear Manualmente (Escribir SKU)</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ej. 7501234567890"
                    value={manualSkuInput}
                    onChange={(e) => setManualSkuInput(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 bg-slate-50/50"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Ingresar
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
