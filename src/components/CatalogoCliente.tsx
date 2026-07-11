import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  MapPin, 
  User, 
  Phone, 
  CreditCard, 
  Sparkles, 
  Filter, 
  CheckCircle, 
  X, 
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { Product, CartItem } from '../types';
import { supabase, mapRowToProduct } from '../lib/supabase';

interface CatalogoClienteProps {
  products: Product[];
  exchangeRate: number;
  whatsappPhone: string;
  onBackToAdmin?: () => void;
}

export default function CatalogoCliente({ 
  products, 
  exchangeRate, 
  whatsappPhone,
  onBackToAdmin 
}: CatalogoClienteProps) {
  const [localProducts, setLocalProducts] = useState<Product[]>(products);

  // Sync state if products prop changes
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Direct .select(*) from productos table
  useEffect(() => {
    async function loadDirectProducts() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('productos')
            .select('*')
            .order('nombre', { ascending: true });
          if (error) {
            console.error('[CatalogoCliente Direct Fetch] Error:', error.message);
          } else if (data) {
            setLocalProducts(data.map(mapRowToProduct));
          }
        } catch (e) {
          console.error('[CatalogoCliente Direct Fetch] Exception:', e);
        }
      }
    }
    loadDirectProducts();
  }, []);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Form states for checkout
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'retiro'>('retiro');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pago Móvil');
  const [notes, setNotes] = useState('');

  // Show order success screen
  const [orderCompleted, setOrderCompleted] = useState(false);

  // Categories list containing the standard presets and any custom product categories
  const categories = useMemo(() => {
    const defaultCategories = [
      'Maquillaje',
      'Cuidado de la piel',
      'Cabello',
      'Hogar',
      'Juguetes para Adultos',
      'Protector Solar',
      'Fajas',
      'Calzado',
      'Brochas y Borlas',
      'Tecnología',
      'Accesorios',
      'Bolsos y carteras',
      'Bolsas y cajas de regalo',
      'Otros'
    ];
    const list = new Set<string>(defaultCategories);
    localProducts.forEach(p => {
      if (p.stock > 0) {
        list.add(p.category);
      }
    });
    return ['Todos', ...Array.from(list)];
  }, [localProducts]);

  // Filter products based on search term and category
  const filteredProducts = useMemo(() => {
    const filtered = localProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      const isAvailable = p.stock > 0; // only show active stock to customers
      return matchesSearch && matchesCategory && isAvailable;
    });

    // Sort alphabetically by category, and then alphabetically by name within each category
    return [...filtered].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category, 'es');
      }
      return a.name.localeCompare(b.name, 'es');
    });
  }, [localProducts, searchTerm, selectedCategory]);

  // Cart helper functions
  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Lo sentimos, solo quedan ${product.stock} unidades de este producto.`);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveOne = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => 
          item.product.id === productId 
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        );
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const handleRemoveAll = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getProductQuantityInCart = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  // Cart Totals
  const totalUSD = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cart]);

  const totalBs = useMemo(() => {
    return totalUSD * exchangeRate;
  }, [totalUSD, exchangeRate]);

  const totalCartItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Launch WhatsApp with a beautiful structured order message
  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      alert('Por favor ingresa tu nombre completo y número de teléfono.');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      alert('Por favor ingresa una dirección de entrega para el delivery.');
      return;
    }

    // Format Whatsapp Message
    let message = `*🛍️ NUEVO PEDIDO - EM TIENDA 🛍️*\n\n`;
    message += `*👤 CLIENTE:*\n`;
    message += `• *Nombre:* ${fullName.trim()}\n`;
    message += `• *Teléfono:* ${phone.trim()}\n\n`;

    message += `*📦 ARTÍCULOS PEDIDOS:*\n`;
    cart.forEach((item, index) => {
      const subtotalItemUSD = item.product.price * item.quantity;
      message += `${index + 1}. *${item.product.name}*\n`;
      message += `   _Cantidad:_ ${item.quantity} u.\n`;
      message += `   _Precio:_ $${item.product.price.toFixed(2)} USD\n`;
      message += `   _Subtotal:_ $${subtotalItemUSD.toFixed(2)} USD\n\n`;
    });

    message += `*💵 RESUMEN DE COMPRA:*\n`;
    message += `• *Total en Dólares:* $${totalUSD.toFixed(2)} USD\n\n`;

    message += `*🛵 MÉTODO DE ENTREGA:*\n`;
    if (deliveryMethod === 'delivery') {
      message += `• *Tipo:* Delivery a domicilio\n`;
      message += `• *Dirección:* ${deliveryAddress.trim()}\n\n`;
    } else {
      message += `• *Tipo:* Retiro en Tienda\n\n`;
    }

    message += `*💳 MÉTODO DE PAGO PREFERIDO:*\n`;
    message += `• ${paymentMethod}\n\n`;

    if (notes.trim()) {
      message += `*📝 NOTAS ADICIONALES:*\n`;
      message += `• ${notes.trim()}\n\n`;
    }

    message += `_¡Hola! Deseo concretar este pedido de la tienda. Quedo atento a sus instrucciones para el pago. Gracias._`;

    // Encode URL parameter
    const encodedMessage = encodeURIComponent(message);
    
    // Clean phone number for WhatsApp URL
    let formattedPhone = whatsappPhone.replace(/[^0-9]/g, '');
    // Ensure country code if missing (default to Venezuela +58)
    if (!formattedPhone.startsWith('58') && formattedPhone.length === 10) {
      formattedPhone = '58' + formattedPhone;
    } else if (formattedPhone.startsWith('0')) {
      formattedPhone = '58' + formattedPhone.substring(1);
    }

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    // Open WhatsApp link
    window.open(whatsappUrl, '_blank');

    // Show custom success panel
    setOrderCompleted(true);
  };

  const handleResetCatalogCart = () => {
    setCart([]);
    setFullName('');
    setPhone('');
    setDeliveryAddress('');
    setNotes('');
    setOrderCompleted(false);
    setIsCartOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col w-full max-w-lg md:max-w-5xl lg:max-w-6xl mx-auto shadow-2xl relative">
      
      {/* Catalog Header banner */}
      <header className="bg-gradient-to-r from-violet-600 via-violet-700 to-indigo-800 text-white p-6 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        
        {/* Abstract design blobs */}
        <div className="absolute -right-10 -top-10 w-36 h-36 bg-violet-500/20 rounded-full blur-2xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <span className="bg-white/15 p-2 rounded-xl backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-pink-300" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-violet-100">Catálogo Oficial</span>
          </div>

          {onBackToAdmin && (
            <button 
              onClick={onBackToAdmin}
              className="text-xs font-bold text-violet-100 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 backdrop-blur-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Admin</span>
            </button>
          )}
        </div>

        <div className="relative z-10 mt-2">
          <h1 className="text-2xl font-black tracking-tight">EM TIENDA</h1>
          <p className="text-xs text-violet-100/90 font-medium leading-relaxed mt-1">
            Explora nuestros productos disponibles, agrégalos al carrito y envíanos tu orden directamente por WhatsApp para coordinar tu entrega y pago.
          </p>
        </div>
      </header>

      {/* Main Catalog View */}
      <main className="flex-1 px-4 py-6 space-y-6">
        
        {/* Search & Categories */}
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, marca o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-xs focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-hidden transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Categories Selector Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                    selectedCategory === cat 
                      ? 'bg-violet-600 text-white shadow-xs' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
            Productos ({filteredProducts.length})
          </h2>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100">
              <p className="text-sm font-semibold text-slate-500">No se encontraron productos disponibles.</p>
              <p className="text-xs text-slate-400 mt-1">Prueba cambiando tu búsqueda o seleccionando otra categoría.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredProducts.map((product) => {
                const qtyInCart = getProductQuantityInCart(product.id);
                const priceInBs = product.price * exchangeRate;
                const isNearOutOfStock = product.stock <= 2;

                return (
                  <div 
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                  >
                    {/* Image space */}
                    <div className="h-32 bg-slate-100 relative overflow-hidden">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      
                      {/* Category Label */}
                      <span className="absolute top-2 left-2 bg-slate-900/60 backdrop-blur-xs text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">
                        {product.category}
                      </span>

                      {/* Stock badge alert if low */}
                      {isNearOutOfStock && (
                        <span className="absolute bottom-2 left-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">
                          ¡Últimas {product.stock} u.!
                        </span>
                      )}
                    </div>

                    {/* Description info */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                          {product.name}
                        </h3>
                        
                        {/* Prices */}
                        <div className="mt-1.5">
                          <span className="text-sm font-extrabold text-violet-900 block">
                            ${product.price.toFixed(2)} USD
                          </span>
                        </div>
                      </div>

                      {/* Cart CTA Trigger */}
                      <div className="mt-3 pt-2.5 border-t border-slate-50">
                        {qtyInCart === 0 ? (
                          <button
                            onClick={() => handleAddToCart(product)}
                            className="w-full py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar</span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between bg-violet-50 rounded-xl p-0.5">
                            <button
                              onClick={() => handleRemoveOne(product.id)}
                              className="p-1 text-violet-700 hover:bg-violet-200/50 rounded-lg transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-black text-violet-950">
                              {qtyInCart}
                            </span>
                            <button
                              onClick={() => handleAddToCart(product)}
                              className="p-1 text-violet-700 hover:bg-violet-200/50 rounded-lg transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Cart Button */}
      {totalCartItems > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between transition-all active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-2 bg-pink-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-violet-600">
                  {totalCartItems}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-violet-200 uppercase tracking-wider leading-none">Ver Carrito</p>
                <p className="text-xs font-extrabold mt-0.5">Siguiente paso: datos de entrega</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-black">${totalUSD.toFixed(2)} USD</p>
            </div>
          </button>
        </div>
      )}

      {/* Full-Screen Shopping Cart Modal Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg h-[92vh] sm:h-[85vh] flex flex-col shadow-2xl animate-slideUp">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-violet-600" />
                <h3 className="text-sm font-black text-slate-900">Tu Pedido ({totalCartItems} artículos)</h3>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {/* Modal Body Scroll Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Product items list */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Productos agregados</h4>
                {cart.map((item) => (
                  <div 
                    key={item.product.id}
                    className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-2.5 rounded-2xl"
                  >
                    <img 
                      src={item.product.image} 
                      alt={item.product.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover rounded-xl shrink-0"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-xs text-slate-800 truncate leading-tight">{item.product.name}</h5>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                        ${item.product.price.toFixed(2)} c/u
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-1 py-0.5">
                        <button
                          onClick={() => handleRemoveOne(item.product.id)}
                          className="p-0.5 hover:bg-slate-100 text-slate-600 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 px-1">{item.quantity}</span>
                        <button
                          onClick={() => handleAddToCart(item.product)}
                          className="p-0.5 hover:bg-slate-100 text-slate-600 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveAll(item.product.id)}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5"
                        title="Quitar todo"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Quitar</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>

              {/* Order total info banner */}
              <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-violet-500 uppercase tracking-wider block">Total estimado a pagar:</span>
                  <span className="text-lg font-black text-violet-950 block mt-0.5">${totalUSD.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Delivery and contact form */}
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
                  Tus Datos de Contacto y Entrega
                </h4>

                {/* Name */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1 font-bold">Nombre Completo *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. María Pérez"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full text-xs font-semibold pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1 font-bold">Celular / WhatsApp *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="tel" 
                      required
                      placeholder="Ej. 04121234567 o +58"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-xs font-semibold pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {/* Delivery Method Segment */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1.5 font-bold">Método de Entrega *</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('retiro')}
                      className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                        deliveryMethod === 'retiro' 
                          ? 'bg-white text-slate-800 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Retiro en Tienda
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('delivery')}
                      className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                        deliveryMethod === 'delivery' 
                          ? 'bg-white text-slate-800 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Delivery a Domicilio
                    </button>
                  </div>
                </div>

                {/* Conditional Delivery Address Input */}
                {deliveryMethod === 'delivery' && (
                  <div className="animate-fadeIn">
                    <label className="text-[10px] text-slate-500 block mb-1 font-bold">Dirección Exacta de Entrega *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <textarea 
                        required
                        rows={2}
                        placeholder="Ej. Calle Principal, Casa #12, sector El Cafetal, Caracas"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full text-xs font-semibold pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1 font-bold">Método de Pago Preferido</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full text-xs font-semibold pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500 outline-none"
                    >
                      <option value="Pago Móvil">Pago Móvil</option>
                      <option value="Dólares en Efectivo (USD)">Dólares en Efectivo (USD)</option>
                      <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                      <option value="Zelle">Zelle</option>
                    </select>
                  </div>
                </div>

                {/* Additional instructions */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1 font-bold">Notas Adicionales (Opcional)</label>
                  <textarea 
                    rows={2}
                    placeholder="Ej. Envolver para regalo / Entregar después de las 2pm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                {/* Final Checkout Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                  <span>Concretar por WhatsApp (Enviar Pedido)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

              </form>
            </div>

          </div>
        </div>
      )}

      {/* Elegant order success modal confirmation */}
      {orderCompleted && (
        <div className="fixed inset-0 bg-slate-900/75 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl animate-scaleIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>

            <h3 className="text-base font-black text-slate-900">¡Pedido Enviado!</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Hemos preparado tu mensaje de pedido con todo el detalle de los productos y tus datos de entrega.
            </p>
            <p className="text-[11px] text-violet-700 font-bold mt-2 bg-violet-50 py-2 px-3 rounded-xl">
              Si la pestaña de WhatsApp no se abrió sola, por favor asegúrate de enviar el texto en el chat con la tienda.
            </p>

            <button
              onClick={handleResetCatalogCart}
              className="w-full mt-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
            >
              Regresar al Catálogo
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
