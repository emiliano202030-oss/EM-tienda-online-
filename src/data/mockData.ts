/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Sale, ClientDebt } from '../types';

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_SALES: Sale[] = [];

export const INITIAL_DEBTS: ClientDebt[] = [];

export const DEFAULT_EXCHANGE_RATE = 36.50; // Bs. por USD

export const DEFAULT_CATALOG_SHARE_TEMPLATE = `¡Hola! Te invito a conocer nuestro catálogo de productos en línea. 🌸✨

Explora lo que tenemos disponible, arma tu pedido y envíalo directamente por WhatsApp aquí:
{catalog_url}

¡Estaremos encantados de atenderte! 😊💖`;

export const DEFAULT_DEBT_REMINDER_TEMPLATE = `Hola *{client_name}*! Espero que estés muy bien. 😊🌸

Te escribo de *EM TIENDA* para recordarte amablemente que tienes un saldo pendiente de *${`{pending_usd}`} USD* (aproximadamente *Bs. {pending_bs}*).

Aquí tienes el detalle de tus compras pendientes:
{unpaid_debts_text}

Si tienes alguna duda o ya realizaste un abono, por favor avísanos. ¡Muchisimas gracias por tu confianza y preferencia! 💖✨`;


