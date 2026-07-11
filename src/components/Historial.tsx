/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  Trash2, 
  RefreshCcw, 
  ChevronDown, 
  Filter, 
  CheckCircle, 
  XCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { Sale } from '../types';

interface HistorialProps {
  sales: Sale[];
  exchangeRate: number;
  onRefundSale: (saleId: string) => void;
}

type DateFilterType = 'Todo' | 'Hoy' | '7 d' | 'Este mes';

export default function Historial({ sales, exchangeRate, onRefundSale }: HistorialProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('Todo');
  const [methodFilter, setMethodFilter] = useState<'Todos' | 'Divisa' | 'Efectivo' | 'Punto' | 'Pago Móvil' | 'Crédito'>('Todos');
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<Sale | null>(null);

  // Filter sales chronologically, by search text, date, and payment method
  const filteredSales = useMemo(() => {
    // Sort chronologically (newest first)
    const sorted = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return sorted.filter((sale) => {
      // 1. Search filter: client name, sale ID, or name of an item inside the sale
      const matchesSearch = 
        sale.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.clientName && sale.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        sale.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Date Filter
      let matchesDate = true;
      const saleDate = new Date(sale.date);
      const now = new Date();

      if (dateFilter === 'Hoy') {
        matchesDate = saleDate.toDateString() === now.toDateString();
      } else if (dateFilter === '7 d') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        matchesDate = saleDate >= sevenDaysAgo;
      } else if (dateFilter === 'Este mes') {
        matchesDate = saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }

      // 3. Payment Method Filter
      const matchesMethod = methodFilter === 'Todos' || sale.paymentMethod === methodFilter;

      return matchesSearch && matchesDate && matchesMethod;
    });
  }, [sales, searchQuery, dateFilter, methodFilter]);

  const handleRefundClick = (sale: Sale) => {
    if (sale.isRefunded) {
      alert('Esta venta ya fue anulada/reembolsada.');
      return;
    }

    const confirmMessage = `¿Estás seguro de que quieres anular esta venta (${sale.id})?\n\n🔄 LÓGICA DE DEVOLUCIÓN INTELIGENTE:\nLas unidades vendidas (${sale.items.reduce((sum, item) => sum + item.quantity, 0)} ítems) se devolverán automáticamente al depósito de stock.`;
    
    if (confirm(confirmMessage)) {
      onRefundSale(sale.id);
      alert('¡Venta anulada con éxito! El stock ha sido reabastecido en el depósito.');
      if (selectedSaleDetails?.id === sale.id) {
        setSelectedSaleDetails(prev => prev ? { ...prev, isRefunded: true } : null);
      }
    }
  };

  return (
    <div id="historial-container" className="flex flex-col h-full bg-slate-50">
      
      {/* Historial Header */}
      <div className="bg-white p-4 border-b border-slate-200/80">
        <h2 className="text-lg font-black text-violet-950 flex items-center gap-2">
          <History className="w-5 h-5 text-violet-600" />
          Bitácora de Ventas
        </h2>
        <p className="text-xs text-slate-500">Historial transaccional y devoluciones de stock</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input 
            id="history-search-input"
            type="text"
            placeholder="Buscar por cliente, producto o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all shadow-xs"
          />
        </div>

        {/* Date and Method Filters row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Date Selector */}
          <div className="flex bg-white rounded-xl border border-slate-200 p-1">
            {(['Todo', 'Hoy', '7 d', 'Este mes'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`flex-1 text-[10px] py-1 font-bold rounded-md transition-all ${
                  dateFilter === filter 
                    ? 'bg-violet-600 text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Method Selector Dropdown style */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="text-xs font-bold px-2 py-1 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-700"
          >
            <option value="Todos">💳 Todos los pagos</option>
            <option value="Divisa">💵 Divisa (USD)</option>
            <option value="Efectivo">🪙 Efectivo (Bs)</option>
            <option value="Punto">💳 Punto de Venta</option>
            <option value="Pago Móvil">📱 Pago Móvil</option>
            <option value="Crédito">👤 Crédito</option>
          </select>
        </div>

        {/* Info intelligent refund notification */}
        <div className="p-3 bg-violet-50 border border-violet-100 rounded-2xl text-[10px] text-violet-800 leading-normal flex items-start gap-2">
          <RefreshCcw className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Devolución Inteligente: </span>
            Al anular o reembolsar una venta, las unidades correspondientes regresan de inmediato al depósito.
          </div>
        </div>

        {/* Sales List */}
        <div className="space-y-2.5">
          {filteredSales.length > 0 ? (
            filteredSales.map((sale) => (
              <div 
                key={sale.id}
                onClick={() => setSelectedSaleDetails(sale)}
                className={`bg-white rounded-2xl border p-3.5 flex flex-col gap-2 cursor-pointer transition-all hover:shadow-md ${
                  sale.isRefunded 
                    ? 'border-red-100 bg-red-50/10 opacity-75' 
                    : 'border-slate-150 hover:border-violet-200'
                }`}
              >
                {/* Header line */}
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-500">#{sale.id.slice(-6).toUpperCase()}</span>
                    <span className="text-[9px] text-slate-400">•</span>
                    <span className="text-[10px] text-slate-400">{new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    sale.isRefunded 
                      ? 'bg-red-100 text-red-600' 
                      : sale.paymentMethod === 'Crédito'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {sale.isRefunded ? 'Anulado' : sale.paymentMethod}
                  </span>
                </div>

                {/* Items & details preview */}
                <div className="flex items-center justify-between">
                  <div className="pr-4 min-w-0 flex-1">
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </p>
                    {sale.clientName && (
                      <p className="text-[10px] text-violet-700 font-bold mt-0.5">Cliente: {sale.clientName}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-black text-violet-950 ${sale.isRefunded ? 'line-through text-slate-400' : ''}`}>
                      ${sale.totalUSD.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-slate-400">{(sale.totalUSD * exchangeRate).toFixed(0)} Bs</p>
                  </div>
                </div>

                {/* Return trigger indicator if not refunded */}
                {!sale.isRefunded && (
                  <div className="flex justify-end pt-1.5 mt-1 border-t border-dashed border-slate-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefundClick(sale);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 font-bold hover:bg-red-50 px-2 py-1 rounded-md"
                    >
                      <Trash2 className="w-3 h-3" />
                      Anular y Devolver
                    </button>
                  </div>
                )}

              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed text-slate-400">
              No hay transacciones registradas que coincidan con los filtros.
            </div>
          )}
        </div>

      </div>

      {/* Sale Details Modal */}
      {selectedSaleDetails && (
        <div id="sale-details-modal" className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-[400px] p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Detalles de Venta</h3>
                <p className="text-[10px] text-slate-400 font-mono">{selectedSaleDetails.id}</p>
              </div>
              <button 
                onClick={() => setSelectedSaleDetails(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-4">
              {/* Date & method row */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Fecha / Hora</span>
                  <strong className="text-slate-700">{new Date(selectedSaleDetails.date).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Método de Pago</span>
                  <strong className="text-slate-700">{selectedSaleDetails.paymentMethod}</strong>
                </div>
              </div>

              {/* Items Table details */}
              <div className="border border-slate-150 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-50 px-3 py-1.5 font-bold text-slate-600 border-b border-slate-150 grid grid-cols-12">
                  <span className="col-span-6">Producto</span>
                  <span className="col-span-2 text-center">Cant</span>
                  <span className="col-span-4 text-right">Monto</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[150px] overflow-y-auto">
                  {selectedSaleDetails.items.map((item, index) => (
                    <div key={index} className="px-3 py-2 grid grid-cols-12 text-[11px]">
                      <span className="col-span-6 font-medium text-slate-800 truncate">{item.name}</span>
                      <span className="col-span-2 text-center text-slate-500">{item.quantity}</span>
                      <span className="col-span-4 text-right font-bold text-slate-700">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-violet-700 uppercase font-black block">Total Cobrado</span>
                  <span className="text-xs text-slate-500">Tasa: {selectedSaleDetails.exchangeRate} Bs</span>
                </div>
                <div className="text-right">
                  <strong className="text-base font-black text-violet-950">${selectedSaleDetails.totalUSD.toFixed(2)}</strong>
                  <p className="text-[10px] text-slate-500">{selectedSaleDetails.totalBs.toFixed(0)} Bs</p>
                </div>
              </div>

              {/* Actions: Refund or Print */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    alert('Imprimiendo recibo fiscal en ticketera térmica...');
                  }}
                  className="py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50"
                >
                  Imprimir Ticket
                </button>
                <button
                  type="button"
                  onClick={() => handleRefundClick(selectedSaleDetails)}
                  disabled={selectedSaleDetails.isRefunded}
                  className={`py-2.5 text-white rounded-xl font-bold text-xs shadow-md transition-colors ${
                    selectedSaleDetails.isRefunded 
                      ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {selectedSaleDetails.isRefunded ? 'Anulado con éxito' : 'Anular Venta'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
