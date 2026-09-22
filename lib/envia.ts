// Llamadas directas a la API REST de Envia (api.envia.com) para cotizar
// envíos en tiempo real. Contrato documentado en docs.envia.com/reference/
// shipping-rates: POST /ship/rate/ con origin/destination/packages, header
// Authorization: Bearer <API key>.
export type EnviaAddress = {
  name: string;
  email?: string;
  phone: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  country: 'CL';
  postalCode?: string;
  reference?: string;
};

export type EnviaRate = {
  carrier: string;
  carrierDescription: string;
  service: string;
  serviceDescription: string;
  deliveryEstimate: string;
  totalPrice: number;
  currency: string;
};

export async function quoteEnviaRates(opts: {
  apiKey: string;
  origin: EnviaAddress;
  destination: EnviaAddress;
  weightKg: number;
  currency: string;
}): Promise<EnviaRate[]> {
  const { apiKey, origin, destination, weightKg, currency } = opts;
  const body = {
    origin,
    destination,
    packages: [
      {
        type: 'box',
        content: 'Productos tejidos a mano',
        amount: 1,
        lengthUnit: 'CM',
        weightUnit: 'KG',
        weight: Math.max(0.1, weightKg),
        dimensions: { length: 25, width: 20, height: 15 },
      },
    ],
    shipment: { type: 1 },
    settings: { currency },
  };
  const response = await fetch('https://api.envia.com/ship/rate/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { data?: EnviaRate[]; error?: { message?: string }; message?: string };
  if (!response.ok || !Array.isArray(data.data)) {
    throw new Error(data.error?.message ?? data.message ?? 'No se pudo cotizar el envío.');
  }
  return data.data
    .map((rate) => ({
      carrier: rate.carrier,
      carrierDescription: rate.carrierDescription,
      service: rate.service,
      serviceDescription: rate.serviceDescription,
      deliveryEstimate: rate.deliveryEstimate,
      totalPrice: rate.totalPrice,
      currency: rate.currency,
    }))
    .sort((a, b) => a.totalPrice - b.totalPrice);
}
