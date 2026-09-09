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

export type ShippingRate = { region: string; cost: number; requires_address?: boolean; warning?: string | null };

export type OrderMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: 'admin' | 'customer';
  body: string;
  created_at: string;
};

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

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'customer' | 'admin';
  created_at: string;
  phone?: string | null;
  region?: string | null;
  comuna?: string | null;
  address?: string | null;
  address_extra?: string | null;
};

export type Address = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  region: string;
  comuna: string;
  address: string;
  address_extra: string | null;
  created_at: string;
};

export type ShowcaseItem = { id: string; title: string; subtitle: string | null; image_url: string; active: boolean; sort_order: number };

export type Faq = { id: string; question: string; answer: string; active: boolean; sort_order: number };
