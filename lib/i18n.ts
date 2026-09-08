export type Lang = 'es' | 'en';

// Traducciones de la interfaz fija (menús, botones, etiquetas de sección).
// Los textos largos y editables (portada, sobre nosotros, etc.) viven en
// StoreContent con sufijo _en y se resuelven en app/page.tsx.
export const ui = {
  es: {
    freeShipping: 'Envíos a todo Chile',
    login: 'Iniciar sesión',
    createAccount: 'Crear cuenta',
    navHome: 'Inicio',
    navShop: 'Tienda',
    navAbout: 'Sobre nosotros',
    navContact: 'Contáctanos',
    searchPlaceholder: 'Busca llaveros, peluches o un personaje...',
    workShowcase: 'Trabajos recientes',
    collectionKicker: 'La colección',
    collectionTitle: 'Elige tu nuevo ',
    collectionHighlight: 'favorito',
    all: 'Todo',
    keychains: 'Llaveros',
    plushies: 'Peluches',
    addToBag: 'Agregar a la bolsita',
    available: 'Disponible',
    soldOut: 'Agotado',
    aboutKicker: 'Sobre nosotros',
    talkToUs: 'Hablemos de tu idea',
    faqTitle: 'Preguntas frecuentes',
    faqKicker: 'Ayuda',
    yourBag: 'Tu bolsita',
    clearCart: 'Vaciar carrito',
    checkout: 'Continuar compra',
    subtotal: 'Subtotal',
  },
  en: {
    freeShipping: 'Shipping all over Chile',
    login: 'Log in',
    createAccount: 'Sign up',
    navHome: 'Home',
    navShop: 'Shop',
    navAbout: 'About us',
    navContact: 'Contact',
    searchPlaceholder: 'Search keychains, plushies, or a character...',
    workShowcase: 'Recent work',
    collectionKicker: 'The collection',
    collectionTitle: 'Pick your new ',
    collectionHighlight: 'favorite',
    all: 'All',
    keychains: 'Keychains',
    plushies: 'Plushies',
    addToBag: 'Add to bag',
    available: 'In stock',
    soldOut: 'Sold out',
    aboutKicker: 'About us',
    talkToUs: "Let's talk about your idea",
    faqTitle: 'Frequently asked questions',
    faqKicker: 'Help',
    yourBag: 'Your bag',
    clearCart: 'Empty cart',
    checkout: 'Checkout',
    subtotal: 'Subtotal',
  },
} as const;

export function t(lang: Lang, key: keyof typeof ui.es): string {
  return ui[lang][key] ?? ui.es[key];
}
