/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  UserCheck, 
  Search, 
  Coins, 
  DollarSign, 
  FileText, 
  PlusCircle, 
  Phone, 
  Calendar, 
  CheckCircle, 
  Clock,
  Sparkles,
  ArrowRight,
  UserPlus,
  MessageCircle,
  History,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { ClientDebt, DebtItem, ClientMovement } from '../types';
import { DEFAULT_DEBT_REMINDER_TEMPLATE } from '../data/mockData';

interface FiadosProps {
  debts: ClientDebt[];
  exchangeRate: number;
  onRegisterAbono: (clientId: string, amountUSD: number) => void;
  onAddClientDebtor: (name: string, phone: string) => void;
  onUpdateClientPhone?: (clientId: string, phone: string) => void;
  onDeleteClient?: (clientId: string) => void;
  onDeleteClientDebt?: (clientId: string, debtId: string) => void;
  debtReminderTemplate?: string;
}

export default function Fiados({ 
  debts, 
  exchangeRate, 
  onRegisterAbono, 
  onAddClientDebtor, 
  onUpdateClientPhone, 
  onDeleteClient, 
  onDeleteClientDebt,
  debtReminderTemplate
}: FiadosProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientDebt | null>(null);
  
  // History Modal state
  const [historyClient, setHistoryClient] = useState<ClientDebt | null>(null);

  // Edit Phone state
  const [editingPhoneClient, setEditingPhoneClient] = useState<ClientDebt | null>(null);
  const [phoneValue, setPhoneValue] = useState<string>('');

  // Abonos Form State
  const [abonoAmount, setAbonoAmount] = useState<string>('');
  const [abonoCurrency, setAbonoCurrency] = useState<'USD' | 'Bs'>('USD');
  const [isAbonoOpen, setIsAbonoOpen] = useState(false);

  // New Client state
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // PDF Simulator state
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // WhatsApp Helpers
  const cleanPhoneForWhatsApp = (phone: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0') && clean.length === 11) {
      clean = '58' + clean.substring(1);
    }
    if (clean.length === 10 && (clean.startsWith('412') || clean.startsWith('414') || clean.startsWith('416') || clean.startsWith('424') || clean.startsWith('426'))) {
      clean = '58' + clean;
    }
    return clean;
  };

  const getWhatsAppLink = (client: ClientDebt) => {
    const cleanPhone = cleanPhoneForWhatsApp(client.phone);
    if (!cleanPhone || client.phone === 'N/A' || client.phone === '') {
      return '';
    }

    const pendingUSD = client.debts
      .filter(d => !d.isPaid)
      .reduce((sum, d) => sum + d.remainingUSD, 0);

    const pendingBs = pendingUSD * exchangeRate;

    const unpaidDebtsText = client.debts
      .filter(d => !d.isPaid)
      .map(d => `• *${d.productSummary}* - Falta *$${d.remainingUSD.toFixed(2)} USD* (fecha: ${new Date(d.date).toLocaleDateString('es-ES')})`)
      .join('\n');

    const rawTemplate = debtReminderTemplate || DEFAULT_DEBT_REMINDER_TEMPLATE;
    const formattedPendingBs = pendingBs.toLocaleString('es-VE', { maximumFractionDigits: 0 });
    const message = rawTemplate
      .replace(/{client_name}/g, client.clientName)
      .replace(/{pending_usd}/g, pendingUSD.toFixed(2))
      .replace(/{pending_bs}/g, formattedPendingBs)
      .replace(/{unpaid_debts_text}/g, unpaidDebtsText);

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleEditPhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoneClient) return;
    if (onUpdateClientPhone) {
      onUpdateClientPhone(editingPhoneClient.id, phoneValue.trim() || 'N/A');
    }
    setEditingPhoneClient(null);
    setPhoneValue('');
    alert('Número de WhatsApp/teléfono actualizado con éxito.');
  };

  // Calculated top headers metrics
  const totalPendingUSD = useMemo(() => {
    return debts.reduce((sum, client) => {
      const pendingForClient = client.debts
        .filter(d => !d.isPaid)
        .reduce((s, d) => s + d.remainingUSD, 0);
      return sum + pendingForClient;
    }, 0);
  }, [debts]);

  const totalPendingBs = useMemo(() => {
    return totalPendingUSD * exchangeRate;
  }, [totalPendingUSD, exchangeRate]);

  // Filtered client list by name or product in purchase list
  const filteredClients = useMemo(() => {
    return debts.filter((client) => {
      const matchesName = client.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProducts = client.debts.some((debt) => 
        debt.productSummary.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return matchesName || matchesProducts;
    });
  }, [debts, searchQuery]);

  const handleRegisterAbonoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    const abonoValue = parseFloat(abonoAmount) || 0;
    if (abonoValue <= 0) {
      alert('Por favor ingrese un monto válido para el abono.');
      return;
    }

    const abonoUSD = abonoCurrency === 'USD' ? abonoValue : abonoValue / exchangeRate;
    
    // Check if abono exceeds total pending debt for client
    const pendingForClient = selectedClient.debts
      .filter(d => !d.isPaid)
      .reduce((s, d) => s + d.remainingUSD, 0);

    if (abonoUSD > pendingForClient + 0.01) {
      if (!confirm(`El abono ($${abonoUSD.toFixed(2)}) supera la deuda total de este cliente ($${pendingForClient.toFixed(2)}). ¿Desea abonar el monto exacto de la deuda en su lugar?`)) {
        return;
      }
      onRegisterAbono(selectedClient.id, pendingForClient);
    } else {
      onRegisterAbono(selectedClient.id, abonoUSD);
    }

    setIsAbonoOpen(false);
    setAbonoAmount('');
    setSelectedClient(null);
    alert('¡Abono registrado y amortizado con éxito!');
  };

  const handleAddNewClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    onAddClientDebtor(newClientName.trim(), newClientPhone.trim() || 'N/A');
    setNewClientName('');
    setNewClientPhone('');
    setIsNewClientOpen(false);
    alert('¡Cliente registrado en cartera de crédito!');
  };

  // Real PDF Report exporter
  const handleExportPDF = () => {
    setPdfGenerating(true);
    try {
      const doc = new jsPDF();
      
      // Page styling - Primary color Violet (124, 58, 237)
      // Header Banner
      doc.setFillColor(124, 58, 237);
      doc.rect(0, 0, 210, 40, 'F');
      
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('EM TIENDA', 14, 18);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Reporte de Cuentas por Cobrar (Crédito)', 14, 25);
      
      // Date and metadata in header
      doc.setFontSize(9);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`, 145, 18);
      doc.text(`Tasa de Cambio: ${exchangeRate.toFixed(2)} Bs/USD`, 145, 25);
      doc.text(`Moneda base: USD`, 145, 30);

      // Summary Card
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.rect(14, 48, 182, 24, 'F');
      doc.setDrawColor(224, 231, 255); // Indigo-100
      doc.rect(14, 48, 182, 24);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(76, 29, 149); // Violet-950
      doc.text('RESUMEN DE CARTERA', 20, 54);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85); // Slate-700
      const activeDebtors = debts.filter(c => c.debts.some(d => !d.isPaid)).length;
      doc.text(`Clientes con saldo pendiente: ${activeDebtors}`, 20, 60);
      doc.text(`Total Cartera por Cobrar: $${totalPendingUSD.toFixed(2)} USD  /  Bs. ${totalPendingBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, 65);

      // Collect debt items
      const tableRows: any[] = [];
      debts.forEach((client) => {
        client.debts.forEach((debt) => {
          tableRows.push([
            client.clientName,
            client.phone || 'N/A',
            new Date(debt.date).toLocaleDateString('es-ES'),
            debt.productSummary,
            `$${debt.amountUSD.toFixed(2)}`,
            `$${debt.remainingUSD.toFixed(2)}`,
            debt.isPaid ? 'PAGADO' : 'PENDIENTE'
          ]);
        });
      });

      if (tableRows.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text('No hay cuentas por cobrar registradas en el sistema.', 14, 85);
      } else {
        autoTable(doc, {
          startY: 80,
          head: [['Cliente', 'Teléfono', 'Fecha', 'Detalle de Compra', 'Monto Total', 'Restante', 'Estado']],
          body: tableRows,
          headStyles: {
            fillColor: [109, 40, 217], // Violet-700
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [51, 65, 85],
            cellPadding: 3
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252] // Slate-50
          },
          margin: { left: 14, right: 14 },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) {
              const val = data.cell.raw as string;
              if (val === 'PAGADO') {
                data.cell.styles.textColor = [16, 185, 129]; // Emerald-600
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [239, 68, 68]; // Red-500
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });
      }

      // Add a small footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(`Página ${i} de ${pageCount}  |  EM Tienda Sistema de Inventario y POS`, 14, 285);
        doc.text('Desarrollado con precisión profesional', 150, 285);
      }

      doc.save(`EM_Tienda_Cartera_Creditos_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar reporte PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div id="fiados-container" className="flex flex-col h-full bg-slate-50">
      
      {/* Fiados Header */}
      <div className="bg-white p-4 border-b border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-violet-950 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-violet-600" />
            Cuentas por Cobrar (Crédito)
          </h2>
          <p className="text-xs text-slate-500">Amortización inteligente de deudas</p>
        </div>
        <div className="flex gap-2">
          <button 
            id="new-client-debtor-btn"
            onClick={() => setIsNewClientOpen(true)}
            className="p-2 border border-violet-200 text-violet-700 hover:bg-violet-50 rounded-xl text-xs font-bold flex items-center gap-1.5"
            title="Registrar Cliente"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Cliente</span>
          </button>
          <button 
            id="export-pdf-btn"
            onClick={handleExportPDF}
            className={`px-3 py-2 text-white bg-violet-600 hover:bg-violet-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all ${pdfGenerating ? 'animate-pulse' : ''}`}
          >
            <FileText className="w-4 h-4" />
            <span>{pdfGenerating ? 'Exportando...' : 'Reporte PDF'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* Double Metrics Stat Card */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Cartera Pendiente (USD)</span>
            <div className="flex items-baseline gap-1 mt-2">
              <DollarSign className="w-4 h-4 text-violet-600 shrink-0 self-center" />
              <span className="text-xl font-black text-violet-950">${totalPendingUSD.toFixed(2)}</span>
            </div>
            <span className="text-[9px] text-slate-400 mt-1">Suma de saldos de clientes</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Cartera Pendiente (Bs.)</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-sm font-black text-violet-600">Bs</span>
              <span className="text-xl font-black text-violet-950">{totalPendingBs.toFixed(0)}</span>
            </div>
            <span className="text-[9px] text-slate-400 mt-1">Tasa actual: {exchangeRate} Bs/USD</span>
          </div>
        </div>

        {/* Client Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input 
            id="debtor-search-input"
            type="text"
            placeholder="Buscar por nombre o artículo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all shadow-xs"
          />
        </div>

        {/* Client Debtors List */}
        <div className="space-y-3">
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => {
              // Calculate pending debts for this specific client
              const clientPendingUSD = client.debts
                .filter(d => !d.isPaid)
                .reduce((sum, d) => sum + d.remainingUSD, 0);

              return (
                <div key={client.id} className="bg-white rounded-2xl border border-slate-150 p-4 shadow-xs space-y-3">
                  
                  {/* Client Info Bar */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">{client.clientName}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className="font-medium text-slate-600">{client.phone}</span>
                          {client.phone !== 'N/A' && (
                            <span className="text-[8px] bg-emerald-50 text-emerald-600 font-extrabold px-1 py-0.5 rounded">WhatsApp</span>
                          )}
                        </p>
                        <button 
                          onClick={() => {
                            setEditingPhoneClient(client);
                            setPhoneValue(client.phone === 'N/A' ? '' : client.phone);
                          }}
                          className="p-1 text-slate-400 hover:text-violet-600 rounded transition-colors"
                          title="Editar número de WhatsApp"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>

                        <button 
                          onClick={() => {
                            if (confirm(`¿Seguro que deseas eliminar al cliente "${client.clientName}"?\n\n🔄 DEVOLUCIÓN A INVENTARIO:\nTodos los productos de sus créditos pendientes se devolverán automáticamente al depósito.`)) {
                              onDeleteClient?.(client.id);
                            }
                          }}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar cliente y devolver mercancía pendiente"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        clientPendingUSD === 0 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {clientPendingUSD === 0 ? 'Pagado' : `$${clientPendingUSD.toFixed(2)} Pendiente`}
                      </span>
                      <p className="text-[9px] text-slate-400 mt-1">~ {(clientPendingUSD * exchangeRate).toFixed(0)} Bs.</p>
                    </div>
                  </div>

                  {/* Individual debts details for this customer */}
                  <div className="space-y-2">
                    {client.debts.map((debt) => (
                      <div key={debt.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-50 rounded-xl gap-2">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="font-bold text-slate-700 truncate">{debt.productSummary}</p>
                          <p className="text-[9px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(debt.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className={`font-bold block ${debt.isPaid ? 'text-emerald-600 line-through' : 'text-slate-800'}`}>
                              ${debt.remainingUSD.toFixed(2)} / ${debt.amountUSD.toFixed(2)}
                            </span>
                            <span className="block text-[9px] text-slate-400 text-right">{debt.isPaid ? 'Pagado' : 'Pendiente'}</span>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`¿Seguro que deseas eliminar este crédito de "${debt.productSummary}"?\n\n🔄 DEVOLUCIÓN A INVENTARIO:\nLos productos correspondientes a este crédito se devolverán de inmediato al depósito.`)) {
                                onDeleteClientDebt?.(client.id, debt.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar este crédito y devolver productos"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Register Abono for this client CTA */}
                  {clientPendingUSD > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedClient(client);
                          setAbonoAmount(clientPendingUSD.toFixed(2)); // pre-fill with total
                          setIsAbonoOpen(true);
                        }}
                        className="py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                        title="Registrar un abono o pago parcial/total"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Abonar Monto</span>
                      </button>
                      <button
                        onClick={() => {
                          const bsAmount = clientPendingUSD * exchangeRate;
                          if (confirm(`¿Confirmar Pago Completo del crédito?\n\nCliente: ${client.clientName}\nMonto a pagar:\n💵 $${clientPendingUSD.toFixed(2)} USD\n🪙 Bs. ${bsAmount.toLocaleString('es-VE', { maximumFractionDigits: 2 })}`)) {
                            onRegisterAbono(client.id, clientPendingUSD);
                            alert('Pago completo registrado con éxito.');
                          }
                        }}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        title="Liquidar la deuda completa del cliente"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Pago Completo</span>
                      </button>
                    </div>
                  )}

                  {/* Action CTA Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setHistoryClient(client)}
                      className="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Movimientos</span>
                    </button>

                    {clientPendingUSD > 0 && client.phone !== 'N/A' && client.phone !== '' ? (
                      <a
                        href={getWhatsAppLink(client)}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors text-center"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Recordatorio WA</span>
                      </a>
                    ) : (
                      <button
                        disabled
                        className="py-2 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                        title={client.phone === 'N/A' ? "Agregue número de teléfono para enviar recordatorios" : "Sin saldo pendiente"}
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-slate-300" />
                        <span>Sin WA</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
              Ningún cliente con cuentas por cobrar pendientes.
            </div>
          )}
        </div>

      </div>

      {/* Register Abono Bottom Sheet/Modal */}
      {isAbonoOpen && selectedClient && (
        <div id="abono-modal" className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-[400px] p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Registrar Abono</h3>
                <p className="text-xs text-slate-500">Abonando a: <strong>{selectedClient.clientName}</strong></p>
              </div>
              <button 
                onClick={() => { setIsAbonoOpen(false); setSelectedClient(null); }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleRegisterAbonoSubmit} className="space-y-4">
              
              <div className="bg-violet-50 p-3 rounded-2xl border border-violet-100 text-xs text-violet-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Lógica de Amortización Automática:
                </p>
                <p className="leading-relaxed">
                  El abono ingresado amortizará automáticamente las deudas de este cliente desde la más antigua a la más reciente hasta agotar el saldo.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Monto del Abono</label>
                  <div className="flex border border-slate-200 rounded overflow-hidden">
                    {(['USD', 'Bs'] as const).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => {
                          setAbonoCurrency(curr);
                          const totalPending = selectedClient.debts
                            .filter(d => !d.isPaid)
                            .reduce((sum, d) => sum + d.remainingUSD, 0);
                          setAbonoAmount(curr === 'USD' ? totalPending.toFixed(2) : (totalPending * exchangeRate).toFixed(0));
                        }}
                        className={`text-[9px] px-2.5 py-0.5 font-bold ${
                          abonoCurrency === curr 
                            ? 'bg-violet-600 text-white' 
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">
                    {abonoCurrency === 'USD' ? '$' : 'Bs'}
                  </span>
                  <input 
                    type="number" 
                    step="any"
                    min="0.01"
                    required
                    value={abonoAmount}
                    onChange={(e) => setAbonoAmount(e.target.value)}
                    className="w-full text-sm font-bold pl-8 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAbonoOpen(false); setSelectedClient(null); }}
                  className="py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Procesar Abono
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {isNewClientOpen && (
        <div id="new-client-modal" className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-[400px] p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900">Nuevo Cliente para Cartera</h3>
              <button 
                onClick={() => setIsNewClientOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleAddNewClientSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre Completo *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. Valeria Gómez"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Número de Teléfono</label>
                <input 
                  type="tel" 
                  placeholder="Ej. +58 412-5551234"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50"
                />
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewClientOpen(false)}
                  className="py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Registrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Phone Modal */}
      {editingPhoneClient && (
        <div id="edit-phone-modal" className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl rounded-b-xl w-full max-w-[400px] p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900">Editar WhatsApp / Teléfono</h3>
              <button 
                onClick={() => setEditingPhoneClient(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleEditPhoneSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">Cliente: <strong>{editingPhoneClient.clientName}</strong></p>
                <label className="text-xs font-bold text-slate-700 block mb-1">Número de WhatsApp / Teléfono</label>
                <input 
                  type="tel" 
                  placeholder="Ej. +584125551234"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Coloque el número con código de país para que redirija a WhatsApp correctamente.</p>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPhoneClient(null)}
                  className="py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement History Modal */}
      {historyClient && (() => {
        // Fallback or reconstruct client movements chronologically if they don't exist
        const clientMovements: ClientMovement[] = historyClient.movements || [
          {
            id: 'move-fallback-init',
            date: historyClient.debts[0]?.date || new Date().toISOString(),
            type: 'registro' as const,
            description: 'Registro inicial de cliente en cartera de créditos',
            amountUSD: 0,
            remainingPendingUSD: 0
          },
          ...historyClient.debts.map((d, idx) => ({
            id: `move-fallback-debt-${idx}`,
            date: d.date,
            type: 'compra' as const,
            description: `Compra registrada a crédito: ${d.productSummary}`,
            amountUSD: d.amountUSD,
            remainingPendingUSD: d.remainingUSD
          }))
        ];

        // Sort movements: newest on top
        const sortedMovements = [...clientMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return (
          <div id="history-movements-modal" className="fixed inset-0 bg-slate-900/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl w-full max-w-[500px] max-h-[85vh] p-6 shadow-2xl flex flex-col animate-slideUp">
              <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5 animate-pulse">
                    <History className="w-5 h-5 text-violet-600" />
                    Historial de Movimientos
                  </h3>
                  <p className="text-xs text-slate-500">Cliente: <strong className="text-slate-700">{historyClient.clientName}</strong></p>
                </div>
                <button 
                  onClick={() => setHistoryClient(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Header metrics card */}
              <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Pendiente</span>
                  <span className="text-lg font-black text-violet-950">${historyClient.totalPendingUSD.toFixed(2)} USD</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Equivalente en Bs.</span>
                  <span className="text-lg font-black text-violet-950">{(historyClient.totalPendingUSD * exchangeRate).toLocaleString('es-VE')} Bs</span>
                </div>
              </div>

              {/* Scrollable list of movements */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {sortedMovements.length > 0 ? (
                  sortedMovements.map((move, index) => {
                    let badgeColor = 'bg-slate-100 text-slate-700';
                    let actionLabel = 'Movimiento';
                    
                    if (move.type === 'registro') {
                      badgeColor = 'bg-cyan-50 text-cyan-700 border border-cyan-150';
                      actionLabel = 'Registro';
                    } else if (move.type === 'compra') {
                      badgeColor = 'bg-amber-50 text-amber-700 border border-amber-150';
                      actionLabel = 'Compra';
                    } else if (move.type === 'abono') {
                      badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-150';
                      actionLabel = 'Abono / Pago';
                    } else if (move.type === 'reembolso') {
                      badgeColor = 'bg-red-50 text-red-700 border border-red-150';
                      actionLabel = 'Reembolso';
                    }

                    const dateObj = new Date(move.date);
                    const formattedDate = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                    const formattedTime = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

                    return (
                      <div key={move.id || index} className="p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${badgeColor}`}>
                            {actionLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formattedDate} - {formattedTime}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-700 leading-snug">{move.description}</p>

                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-50 text-slate-500">
                          <div>
                            {move.amountUSD > 0 && (
                              <span>Monto: <strong className="text-slate-700">${move.amountUSD.toFixed(2)} USD</strong></span>
                            )}
                          </div>
                          <div>
                            <span>Deuda Restante: <strong className="text-violet-950 font-black">${move.remainingPendingUSD.toFixed(2)} USD</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No hay movimientos registrados para este cliente.
                  </div>
                )}
              </div>

              {/* Close Button at bottom */}
              <button
                onClick={() => setHistoryClient(null)}
                className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-colors text-center"
              >
                Entendido
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
