/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingBag, Package, BarChart3, History, UserCheck } from 'lucide-react';

export type TabType = 'caja' | 'deposito' | 'metricas' | 'historial' | 'fiados';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  cartCount: number;
  lowStockCount: number;
  pendingDebtsCount: number;
}

export default function BottomNav({ 
  activeTab, 
  onChangeTab, 
  cartCount, 
  lowStockCount, 
  pendingDebtsCount 
}: BottomNavProps) {
  
  const navItems = [
    { id: 'caja' as TabType, label: 'Caja', icon: ShoppingBag, badge: cartCount, badgeColor: 'bg-violet-600' },
    { id: 'deposito' as TabType, label: 'Depósito', icon: Package, badge: lowStockCount, badgeColor: 'bg-amber-500' },
    { id: 'metricas' as TabType, label: 'Métricas', icon: BarChart3 },
    { id: 'historial' as TabType, label: 'Historial', icon: History },
    { id: 'fiados' as TabType, label: 'Crédito', icon: UserCheck, badge: pendingDebtsCount, badgeColor: 'bg-red-500' },
  ];

  return (
    <nav id="bottom-navigation-bar" className="fixed bottom-0 left-0 right-0 md:absolute max-w-[460px] md:max-w-none mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 h-16 flex items-center justify-around px-2 z-40 shadow-xl rounded-t-2xl md:rounded-t-none md:rounded-b-3xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onChangeTab(item.id)}
            className="flex flex-col items-center justify-center flex-1 h-full relative group transition-all duration-150 active:scale-95"
            title={item.label}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              isActive 
                ? 'bg-violet-100 text-violet-700 font-black scale-110' 
                : 'text-slate-400 hover:text-slate-600'
            }`}>
              <Icon className="w-5 h-5 transition-transform group-hover:scale-105" />
            </div>
            
            <span className={`text-[10px] mt-0.5 font-bold transition-colors ${
              isActive ? 'text-violet-900 font-extrabold' : 'text-slate-400'
            }`}>
              {item.label}
            </span>

            {/* Notification Badge */}
            {item.badge !== undefined && item.badge > 0 && (
              <span className={`absolute top-2 right-4 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center animate-pulse ${item.badgeColor}`}>
                {item.badge}
              </span>
            )}

            {/* Cute bottom dot indicator */}
            {isActive && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-violet-600"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
