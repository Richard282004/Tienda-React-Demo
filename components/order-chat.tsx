'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { type OrderMessage } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import './order-chat.css';

type Props = {
  orderId: string;
  senderRole: 'admin' | 'customer';
  currentUserId: string;
};

// Chat en tiempo real por pedido (Supabase Realtime). Colapsado por defecto;
// se abre al hacer clic, y desde ahí queda suscrito a mensajes nuevos.
export function OrderChat({ orderId, senderRole, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from('order_messages').select('*').eq('order_id', orderId).order('created_at').then(({ data }) => {
      if (active) setMessages((data ?? []) as OrderMessage[]);
    });
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        const message = payload.new as OrderMessage;
        setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
        if (message.sender_id !== currentUserId) setUnread(true);
      })
      .subscribe();
    return () => { active = false; void supabase!.removeChannel(channel); };
  }, [orderId, currentUserId]);

  useEffect(() => {
    if (open) { setUnread(false); listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }
  }, [open, messages]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !text.trim()) return;
    setSending(true);
    const body = text.trim();
    const { error } = await supabase.from('order_messages').insert({ order_id: orderId, sender_id: currentUserId, sender_role: senderRole, body });
    setSending(false);
    if (!error) {
      setText('');
      // Aviso por correo es un complemento del chat en vivo; si falla, el
      // mensaje ya quedó guardado y visible igual.
      fetch('/api/order-messages/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, senderRole, body }),
      }).catch(() => {});
    }
  };

  return (
    <div className="order-chat">
      <button type="button" className="order-chat-toggle" onClick={() => setOpen((value) => !value)}>
        <MessageCircle size={15} /> {open ? 'Ocultar chat' : 'Chat del pedido'}{unread && !open && <span className="order-chat-dot" />}
      </button>
      {open && (
        <div className="order-chat-panel">
          <div className="order-chat-messages" ref={listRef}>
            {messages.length === 0 && <p className="order-chat-empty">Sin mensajes todavía.</p>}
            {messages.map((message) => (
              <div key={message.id} className={`order-chat-bubble ${message.sender_id === currentUserId ? 'mine' : ''}`}>
                <span className="order-chat-role">
                  {message.sender_id === currentUserId ? 'Yo' : message.sender_role === 'admin' ? 'Tienda' : 'Cliente'}
                </span>
                <p>{message.body}</p>
              </div>
            ))}
          </div>
          <form className="order-chat-form" onSubmit={send}>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Escribe un mensaje…" maxLength={2000} />
            <button type="submit" disabled={sending || !text.trim()} aria-label="Enviar mensaje"><Send size={15} /></button>
          </form>
        </div>
      )}
    </div>
  );
}
