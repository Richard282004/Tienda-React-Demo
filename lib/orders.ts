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
  discount_code: string | null;
  discount_amount: number;
  total: number;
  status: OrderStatus;
  tracking_number: string | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ShippingRate = { region: string; cost: number };

export type DiscountCode = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
};

export type ProductImage = { id: string; product_id: string; image_url: string; sort_order: number };

export type Review = {
  id: string;
  product_id: string;
  user_id: string | null;
  customer_name: string;
  rating: number;
  comment: string | null;
  approved: boolean;
  created_at: string;
};

export type Profile = { id: string; email: string | null; full_name: string | null; role: 'customer' | 'admin'; created_at: string };
