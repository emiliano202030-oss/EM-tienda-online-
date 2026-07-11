/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus,
  Search, 
  Package, 
  AlertTriangle, 
  Sparkles, 
  DollarSign, 
  TrendingUp, 
  Camera, 
  Barcode, 
  Trash2, 
  Edit3, 
  Check, 
  ArrowUpRight,
  Gauge,
  QrCode
} from 'lucide-react';
import { Product } from '../types';
import { supabase, mapRowToProduct } from '../lib/supabase';

function compressImage(base64Str: string, maxWidth = 360, maxHeight = 360, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
}

interface DepositoProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  isOpenAddModal: boolean;
  setIsOpenAddModal: (open: boolean) => void;
}

export default function Deposito({ 
  products, 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct,
  isOpenAddModal,
  setIsOpenAddModal
}: DepositoProps) {
  
  const [localProducts, setLocalProducts] = useState<Product[]>(products);

  // Keep localProducts in sync when the props change
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
            console.error('[Deposito Direct Fetch] Error:', error.message);
          } else if (data) {
            setLocalProducts(data.map(mapRowToProduct));
          }
        } catch (e) {
          console.error('[Deposito Direct Fetch] Exception:', e);
        }
      }
    }
    loadDirectProducts();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | 'Maquillaje' | 'Cuidado de la piel' | 'Cabello' | 'Hogar' | 'Juguetes para Adultos' | 'Protector Solar' | 'Fajas' | 'Calzado' | 'Brochas y Borlas' | 'Tecnología' | 'Accesorios' | 'Bolsos y carteras' | 'Bolsas y cajas de regalo' | 'Otros'>('Todos');

  // Add/Edit Product form state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(2);
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState<'Maquillaje' | 'Cuidado de la piel' | 'Cabello' | 'Hogar' | 'Juguetes para Adultos' | 'Protector Solar' | 'Fajas' | 'Calzado' | 'Brochas y Borlas' | 'Tecnología' | 'Accesorios' | 'Bolsos y carteras' | 'Bolsas y cajas de regalo' | 'Otros'>('Maquillaje');
  const [image, setImage] = useState('https://images.unsplash.com/photo-1578932750294-f5075e85f44a?auto=format&fit=crop&w=300&q=80');

  // QR Code visualization state
  const [qrSelectedProduct, setQrSelectedProduct] = useState<Product | null>(null);

  // Photo compressor simulator state
  const [isUploading, setIsUploading] = useState(false);
  const [compressionRatio, setCompressionRatio] = useState<string | null>(null);

  const handleCompressAndSetPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setCompressionRatio(null);

    const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const rawBase64 = reader.result as string;
        if (!rawBase64) {
          setIsUploading(false);
          return;
        }
        
        // Comprimir la imagen de forma real usando Canvas a max 320x320 con calidad 0.7
        const compressedBase64 = await compressImage(rawBase64, 320, 320, 0.7);
        
        // Calcular tamaño comprimido real
        const compressedSizeBytes = Math.round((compressedBase64.length * 3) / 4);
        const compressedSizeKB = (compressedSizeBytes / 1024).toFixed(1);
        const savedPercent = Math.round((1 - (compressedSizeBytes / file.size)) * 100);
        
        setImage(compressedBase64);
        setCompressionRatio(
          `Foto de ${originalSizeMB} MB comprimida con éxito a ${compressedSizeKB} KB (¡${savedPercent}% de ahorro en almacenamiento y carga ultra-rápida!) 🦄`
        );
      } catch (error) {
        console.error('Error al comprimir la imagen:', error);
        setImage(reader.result as string || 'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?auto=format&fit=crop&w=300&q=80');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const generateBarcodeSimulator = () => {
    const code = Math.floor(7500000000000 + Math.random() * 99999999999).toString();
    setSku(code);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const productPayload: Product = {
      id: editingProductId || `prod-${Date.now()}`,
      name: name.trim(),
      sku: sku.trim() || `sku-${Date.now()}`,
      price: Number(price),
      cost: 0,
      profitPercent: 0,
      stock: Number(stock),
      minStock: Number(minStock),
      category,
      image
    };

    if (editingProductId) {
      onUpdateProduct(productPayload);
    } else {
      onAddProduct(productPayload);
    }

    // Reset Form & close
    resetForm();
    setIsOpenAddModal(false);
  };

  const resetForm = () => {
    setEditingProductId(null);
    setName('');
    setSku('');
    setStock(0);
    setMinStock(2);
    setPrice(0);
    setCategory('Maquillaje');
    setImage('https://images.unsplash.com/photo-1578932750294-f5075e85f44a?auto=format&fit=crop&w=300&q=80');
    setCompressionRatio(null);
  };

  const handleEditInit = (product: Product) => {
    setEditingProductId(product.id);
    setName(product.name);
    setSku(product.sku);
    setStock(product.stock);
    setMinStock(product.minStock);
    setPrice(product.price);
    setCategory(product.category);
    setImage(product.image);
    setIsOpenAddModal(true);
  };

  const handleStockAdjust = (product: Product, delta: number) => {
    const updated = {
      ...product,
      stock: Math.max(0, product.stock + delta)
    };
    onUpdateProduct(updated);
  };

  // Filter products list
  const filteredProducts = localProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.sku.includes(searchQuery);
    const matchesCategory = categoryFilter === 'Todos' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div id="deposito-inventory-container" className="flex flex-col h-full bg-slate-50">
      
      {/* Depósito Header */}
      <div className="bg-white p-4 border-b border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-violet-950 flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-600" />
            Depósito de Productos
          </h2>
          <p className="text-xs text-slate-500">Administra el inventario de tu tienda</p>
        </div>
        <button 
          id="open-add-product-btn"
          onClick={() => { resetForm(); setIsOpenAddModal(true); }}
          className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* Search and Category Filter section */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              id="inventory-search-input"
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all shadow-xs"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(['Todos', 'Maquillaje', 'Cuidado de la piel', 'Cabello', 'Hogar', 'Juguetes para Adultos', 'Protector Solar', 'Fajas', 'Calzado', 'Brochas y Borlas', 'Tecnología', 'Accesorios', 'Bolsos y carteras', 'Bolsas y cajas de regalo', 'Otros'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all border ${
                  categoryFilter === cat 
                    ? 'bg-violet-600 text-white border-violet-600 shadow-xs' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Low Stock Warning Summary Box */}
        {localProducts.some(p => p.stock <= p.minStock) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">¡Alerta de Stock Mínimo!</p>
              <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                Tienes productos que han alcanzado o superado su nivel de alerta mínimo. Repón el inventario pronto para evitar perder ventas.
              </p>
            </div>
          </div>
        )}

        {/* Inventory Table/List Cards */}
        <div className="space-y-2.5">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const isLowStock = product.stock <= product.minStock;
              return (
                <div 
                  key={product.id}
                  className={`bg-white rounded-2xl border p-3 flex gap-3 items-center justify-between transition-all hover:shadow-sm ${
                    isLowStock ? 'border-amber-200 bg-amber-50/10' : 'border-slate-150'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Image block */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-extrabold text-slate-800 truncate">{product.name}</h4>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">{product.category}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {product.sku}</p>
                      
                      {/* Financial info block */}
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="font-extrabold text-violet-900">${product.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stock adjuster and editing actions column */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg">
                      <button 
                        onClick={() => handleStockAdjust(product, -1)}
                        className="p-1 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition-all"
                        title="Restar Stock"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className={`text-xs font-black min-w-6 text-center ${
                        product.stock === 0 ? 'text-red-600' : isLowStock ? 'text-amber-600 font-extrabold' : 'text-slate-800'
                      }`}>
                        {product.stock}
                      </span>
                      <button 
                        onClick={() => handleStockAdjust(product, 1)}
                        className="p-1 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition-all"
                        title="Sumar Stock"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Edit / Delete small buttons */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setQrSelectedProduct(product)}
                        className="p-1 text-violet-600 hover:bg-violet-50 rounded-lg transition-all flex items-center justify-center"
                        title="Generar y ver Código QR"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleEditInit(product)}
                        className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                        title="Editar Producto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`¿Estás seguro de que quieres eliminar "${product.name}" del depósito?`)) {
                            onDeleteProduct(product.id);
                          }
                        }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed text-slate-400">
              Ningún producto coincide con la búsqueda o filtro.
            </div>
          )}
        </div>

      </div>

      {/* Add / Edit product Modal Form */}
      {isOpenAddModal && (
        <div id="add-product-modal" className="fixed inset-0 bg-slate-900/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl rounded-b-xl w-full max-w-[400px] p-6 shadow-2xl animate-slideUp overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-black text-slate-900">
                {editingProductId ? 'Modificar Producto' : 'Nuevo Producto'}
              </h3>
              <button 
                onClick={() => { resetForm(); setIsOpenAddModal(false); }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              
              {/* Product Photo Uploader Simulator */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Imagen del Producto</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                    <img src={image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {isUploading && (
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors rounded-xl text-xs font-extrabold cursor-pointer border border-violet-200">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Subir Foto</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleCompressAndSetPhoto}
                        className="hidden" 
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1">Simulador de compresor automático PWA integrado.</p>
                  </div>
                </div>

                {/* Compression stats box */}
                {compressionRatio && (
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-800 flex items-start gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
                    <span>{compressionRatio}</span>
                  </div>
                )}
              </div>

              {/* Name field */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre del Producto *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. Tinta Labial Durazno"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 bg-slate-50/50"
                />
              </div>

              {/* Barcode SKU & simulated scan button */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Código de Barras (SKU)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ej. 7501234567890"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 bg-slate-50/50"
                  />
                  <button 
                    type="button"
                    onClick={generateBarcodeSimulator}
                    className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1 shrink-0"
                    title="Simular Lector"
                  >
                    <Barcode className="w-4 h-4" />
                    <span className="text-[10px]">Generar</span>
                  </button>
                </div>
              </div>

              {/* Category selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Categoría</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 bg-slate-50/50"
                >
                  <option value="Maquillaje">Maquillaje</option>
                  <option value="Cuidado de la piel">Cuidado de la piel</option>
                  <option value="Cabello">Cabello</option>
                  <option value="Hogar">Hogar</option>
                  <option value="Juguetes para Adultos">Juguetes para Adultos</option>
                  <option value="Protector Solar">Protector Solar</option>
                  <option value="Fajas">Fajas</option>
                  <option value="Calzado">Calzado</option>
                  <option value="Brochas y Borlas">Brochas y Borlas</option>
                  <option value="Tecnología">Tecnología</option>
                  <option value="Accesorios">Accesorios</option>
                  <option value="Bolsos y carteras">Bolsos y carteras</option>
                  <option value="Bolsas y cajas de regalo">Bolsas y cajas de regalo</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              {/* Pricing section: Sale price */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1 font-bold">Precio de Venta ($) *</label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    required
                    placeholder="Ej. 12.00"
                    value={price || ''}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Inventory Stock details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Stock Inicial *</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    placeholder="Ej. 10"
                    value={stock || ''}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Stock Mínimo (Alerta)</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    placeholder="Ej. 2"
                    value={minStock || ''}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { resetForm(); setIsOpenAddModal(false); }}
                  className="py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className={`py-2.5 rounded-xl font-bold text-xs shadow-md transition-colors ${
                    isUploading
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-violet-600 hover:bg-violet-700 text-white'
                  }`}
                >
                  {isUploading ? 'Procesando Foto...' : 'Guardar Producto'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Product QR Code Viewer Modal */}
      {qrSelectedProduct && (
        <div id="product-qr-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-[360px] p-6 shadow-2xl animate-fadeIn relative flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-violet-600" />
                Código QR de Producto
              </h3>
              <button 
                onClick={() => setQrSelectedProduct(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 hover:bg-slate-50 rounded-lg"
              >
                Cerrar
              </button>
            </div>

            {/* QR Image container */}
            <div className="p-4 bg-violet-50/50 rounded-2xl border border-violet-100 flex flex-col items-center justify-center mb-4 w-full relative group">
              <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-100">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=2e1065&data=${encodeURIComponent(qrSelectedProduct.sku)}`} 
                  alt={`QR ${qrSelectedProduct.sku}`}
                  className="w-[180px] h-[180px] object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[10px] text-violet-600 font-bold mt-2 flex items-center gap-1 bg-violet-100/50 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 animate-pulse" />
                Escaneable en Caja
              </p>
            </div>

            {/* Product Meta Data Details card */}
            <div className="w-full bg-slate-50 rounded-2xl border border-slate-150 p-3.5 space-y-2 mb-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Producto:</span>
                <span className="font-extrabold text-slate-800 text-right truncate max-w-[200px]">{qrSelectedProduct.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Código SKU:</span>
                <span className="font-mono font-black text-violet-950">{qrSelectedProduct.sku}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Categoría:</span>
                <span className="font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full text-[10px]">{qrSelectedProduct.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Precio POS:</span>
                <span className="font-extrabold text-violet-900">${qrSelectedProduct.price.toFixed(2)}</span>
              </div>
            </div>

            {/* Print & Copy Actions row */}
            <div className="w-full grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrSelectedProduct.sku);
                  alert(`¡Código SKU "${qrSelectedProduct.sku}" copiado al portapapeles!`);
                }}
                className="py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Copiar Código</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(`🖨️ Generando plantilla de impresión para pegatina adhesiva...\n\nProducto: ${qrSelectedProduct.name}\nSKU: ${qrSelectedProduct.sku}\n\nListo para mandar a impresora de etiquetas térmica.`);
                }}
                className="py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Imprimir Sticker</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
