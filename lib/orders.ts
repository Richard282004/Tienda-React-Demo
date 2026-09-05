export const CHILE_REGIONS = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana de Santiago',
  "Libertador General Bernardo O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén del General Carlos Ibáñez del Campo',
  'Magallanes y de la Antártica Chilena',
] as const;

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export const orderStatusLabel: Record<OrderStatus, string> = {
  pending: 'Pendiente de pago',
  paid: 'Pagado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export type OrderItem = { productId: string; name: string; unitPrice: number; quantity: number };

export type Order = {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  region: string;
  comuna: string;
  address: string;
  address_extra: string | null;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  total: number;
  status: OrderStatus;
  tracking_number: string | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ShippingRate = { region: string; cost: number };
