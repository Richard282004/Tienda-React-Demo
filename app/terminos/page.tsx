import type { Metadata } from 'next';
import './legal.css';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de compra, envío, cambios y devoluciones de Lúmina.',
};

export default function TerminosPage() {
  return (
    <main className="legal-shell">
      <article className="legal-card">
        <a className="legal-back" href="/">← Volver a la tienda</a>
        <h1>Términos y condiciones</h1>
        <p className="legal-updated">Última actualización: {new Date().toLocaleDateString('es-CL')}</p>

        <h2>1. Quiénes somos</h2>
        <p>Lúmina es una tienda de llaveros y peluches de crochet hechos a mano. Al comprar en este sitio aceptas estas condiciones.</p>

        <h2>2. Productos y precios</h2>
        <p>Cada producto se muestra con nombre, descripción, fotografía referencial, precio en pesos chilenos (CLP) y disponibilidad. Al ser piezas artesanales hechas a mano, pueden existir pequeñas variaciones de color o forma respecto a la fotografía. Los precios incluyen IVA cuando corresponda.</p>

        <h2>3. Proceso de compra y pago</h2>
        <p>El pago se procesa a través de Mercado Pago. El pedido queda confirmado solo cuando el pago es aprobado. Si el pago es rechazado o queda pendiente, el pedido no se despacha hasta confirmar el pago.</p>

        <h2>4. Envíos</h2>
        <p>Despachamos a todo Chile. El costo de envío se calcula según la región indicada al pagar y se muestra antes de confirmar la compra. Los plazos de entrega son estimados y pueden variar según la empresa de transporte y la comuna de destino.</p>

        <h2>5. Derecho a retracto</h2>
        <p>De acuerdo con la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores, tienes derecho a retractarte de tu compra dentro de <strong>10 días corridos</strong> desde que recibes el producto, siempre que este se encuentre en las mismas condiciones en que fue entregado, sin uso y con su embalaje original. Para ejercer este derecho, contáctanos por los medios indicados en <a href="/#contacto">Contáctanos</a>.</p>
        <p>Los costos de despacho de la devolución corren por cuenta del cliente, salvo que el producto presente una falla o error atribuible a la tienda.</p>

        <h2>6. Cambios y devoluciones por fallas</h2>
        <p>Si tu producto llega con una falla de fabricación o distinto a lo comprado, contáctanos dentro de 7 días de recibido con fotos del producto. Evaluamos cada caso para reposición, cambio o devolución del dinero, conforme a la Ley del Consumidor.</p>

        <h2>7. Cuentas de usuario</h2>
        <p>Puedes comprar creando una cuenta con correo y contraseña, o mediante tu cuenta de Google. Eres responsable de mantener la confidencialidad de tu contraseña.</p>

        <h2>8. Contacto</h2>
        <p>Ante dudas, reclamos o para ejercer tus derechos como consumidor, escríbenos por los canales publicados en la página de <a href="/#contacto">Contáctanos</a>.</p>
      </article>
    </main>
  );
}
