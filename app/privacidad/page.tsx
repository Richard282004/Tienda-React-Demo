import type { Metadata } from 'next';
import '../terminos/legal.css';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Cómo Lúmina recopila, usa y protege tus datos personales.',
};

export default function PrivacidadPage() {
  return (
    <main className="legal-shell">
      <article className="legal-card">
        <a className="legal-back" href="/">← Volver a la tienda</a>
        <h1>Política de privacidad</h1>
        <p className="legal-updated">Última actualización: {new Date().toLocaleDateString('es-CL')}</p>

        <h2>1. Qué datos recopilamos</h2>
        <p>Cuando creas una cuenta, compras o inicias sesión con Google, recopilamos: nombre, correo electrónico, teléfono, dirección de despacho (región, comuna, dirección) y el historial de tus pedidos. Si inicias sesión con Google, recibimos tu nombre y correo asociados a esa cuenta.</p>

        <h2>2. Para qué usamos tus datos</h2>
        <ul>
          <li>Procesar y despachar tus pedidos.</li>
          <li>Enviarte correos sobre el estado de tu compra (confirmación, envío, entrega).</li>
          <li>Darte acceso a tu cuenta y tu historial de pedidos.</li>
          <li>Responder tus consultas de contacto.</li>
        </ul>
        <p>No vendemos ni compartimos tus datos personales con terceros para fines publicitarios.</p>

        <h2>3. Con quién compartimos datos</h2>
        <p>Para operar la tienda usamos proveedores de servicios que procesan datos en nuestro nombre:</p>
        <ul>
          <li><strong>Supabase</strong>: almacenamiento de tu cuenta, pedidos y fotografías de productos.</li>
          <li><strong>Mercado Pago</strong>: procesamiento del pago (nunca vemos ni almacenamos los datos de tu tarjeta).</li>
          <li><strong>Google</strong>: si eliges iniciar sesión con tu cuenta de Google.</li>
          <li><strong>Resend</strong>: envío de los correos transaccionales de tu pedido.</li>
          <li><strong>Cloudflare</strong>: alojamiento del sitio web.</li>
        </ul>

        <h2>4. Tus derechos</h2>
        <p>Puedes solicitar acceder, corregir o eliminar tus datos personales, o el cierre de tu cuenta, escribiéndonos por los canales de la sección <a href="/#contacto">Contáctanos</a>. Responderemos dentro de un plazo razonable.</p>

        <h2>5. Cookies y almacenamiento local</h2>
        <p>Usamos almacenamiento local del navegador para recordar tu carrito de compras y favoritos mientras navegas. No usamos cookies de rastreo publicitario propias.</p>

        <h2>6. Seguridad</h2>
        <p>Tu contraseña se guarda cifrada por Supabase; nunca tenemos acceso a ella en texto plano. Las conexiones al sitio y a los servicios de pago usan cifrado HTTPS.</p>

        <h2>7. Contacto</h2>
        <p>Para cualquier consulta sobre esta política, contáctanos en la sección <a href="/#contacto">Contáctanos</a> de la tienda.</p>
      </article>
    </main>
  );
}
