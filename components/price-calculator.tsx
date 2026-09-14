'use client';
import { useState } from 'react';
import { saleBreakdown, suggestedPrice, validatePricing, type PricingInput } from '@/lib/price-calculator';
import { Input } from '@/components/ui/input';
import './price-calculator.css';

export function PriceCalculator() {
  const [tax, setTax] = useState('iva');
  const [feeIncludesVat, setFeeIncludesVat] = useState(false);
  const [chargeByHour, setChargeByHour] = useState(false);
  const [values, setValues] = useState({ costs: '', shippingCost: '0', shippingCharged: '0', feePercent: '', fixedFee: '0', inputVatCredit: '0', reservePercent: '0', hours: '0', hourlyPay: '0', extraProfit: '', currentPrice: '' });
  const field = (key: keyof typeof values, label: string, hint?: string) => <label>{label}<Input type="number" min="0" step="any" inputMode="decimal" value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />{hint && <small>{hint}</small>}</label>;
  const input: PricingInput = { costs: Number(values.costs), shippingCost: Number(values.shippingCost), shippingCharged: Number(values.shippingCharged), feePercent: Number(values.feePercent), fixedFee: Number(values.fixedFee), feeIncludesVat, vatPercent: tax === 'iva' ? 19 : 0, inputVatCredit: tax === 'iva' ? Number(values.inputVatCredit) : 0, reservePercent: Number(values.reservePercent), hours: chargeByHour ? Number(values.hours) : 0, hourlyPay: chargeByHour ? Number(values.hourlyPay) : 0, extraProfit: Number(values.extraProfit || 0) };
  const requiredFields = ['costs', 'feePercent', 'extraProfit'] as const;
  const ready = tax !== '' && requiredFields.every((key) => values[key].trim() !== '') && (!chargeByHour || (values.hours.trim() !== '' && values.hourlyPay.trim() !== ''));
  let error = ready ? validatePricing(input) : null;
  let suggested: number | null = null;
  if (ready && !error) { try { suggested = suggestedPrice(input); } catch (caught) { error = (caught as Error).message; } }
  const result = suggested === null ? null : saleBreakdown(suggested, input);
  const current = ready && !error && values.currentPrice.trim() && Number(values.currentPrice) >= 0 ? saleBreakdown(Number(values.currentPrice), input) : null;
  const money = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
  return <section className="price-calculator">
    <div className="admin-section-heading"><div><h2>Calculadora de precios</h2><p>Calcula una venta de una unidad, en pesos chilenos. No cambia tus productos.</p></div></div>
    <div className="pricing-layout"><div className="pricing-form">
      <section><h3>Tu producto y tu ganancia</h3><div className="pricing-fields">
        {field('costs', 'Materiales, empaque y otros costos ($)', 'Lo que te costó la lana, el empaque, etc. Total por unidad.')}
        {field('extraProfit', 'Cuánto quieres ganar por esta venta ($)', 'Lo que te queda a ti, después de costos y comisión.')}
      </div>
        <label className="pricing-check"><input type="checkbox" checked={chargeByHour} onChange={(event) => setChargeByHour(event.target.checked)} /> Prefiero cobrar por tiempo trabajado</label>
        {chargeByHour && <div className="pricing-fields">
          {field('hours', 'Horas de trabajo por unidad', 'Por ejemplo, 0,5 para media hora.')}
          {field('hourlyPay', 'Cuánto quieres recibir por hora ($)')}
        </div>}
      </section>
      <section><h3>Comisión de Mercado Pago</h3>
        <p>Copia la tarifa de Checkout de tu cuenta, según el plazo de disponibilidad y las cuotas. No se suma una comisión de Mercado Libre porque esta venta es en tu web.</p>
        <div className="pricing-fields">{field('feePercent', 'Comisión (%)')}{field('fixedFee', 'Cargo fijo por venta ($)')}</div>
        <label className="pricing-check"><input type="checkbox" checked={feeIncludesVat} onChange={(event) => setFeeIncludesVat(event.target.checked)} /> Los cargos ingresados ya incluyen IVA</label>
        <small>{feeIncludesVat ? 'Se descuentan tal como los ingresaste.' : 'Se agrega 19% de IVA a la comisión y al cargo fijo.'}</small>
        <a href="https://www.mercadopago.cl/ayuda/37740" target="_blank" rel="noreferrer">Consultar mi comisión ↗</a>
      </section>
      <section><h3>IVA e impuestos</h3><label>Tratamiento de esta venta<select value={tax} onChange={(event) => setTax(event.target.value)}><option value="">Selecciona para calcular</option><option value="iva">Simular venta afecta a IVA (19%)</option><option value="exempt">Venta exenta o no afecta, ya confirmada</option></select></label>
        <p>No haber iniciado actividades no significa estar exento. Si no sabes, puedes simular con IVA y confirmar tu situación con el SII.</p>
        <details><summary>Crédito de IVA y reserva para renta</summary><div className="pricing-fields">
          {tax === 'iva' && field('inputVatCredit', 'Crédito fiscal atribuible a esta venta ($)', 'Solo IVA recuperable respaldado por facturas, incluidos costos y comisión si corresponde. Deja 0 si no lo has confirmado.')}
          {field('reservePercent', 'Reserva estimada para renta (%)', 'Sobre el saldo positivo después de costos e IVA. Es una reserva personal, no una tasa oficial del SII.')}
        </div></details>
        <small>El IVA se calcula dentro del precio final (19/119). Su pago real se determina mensualmente con débito y crédito fiscal. Renta, PPM y otros ajustes dependen de tu régimen; no se liquidan aquí.</small>
        <a href="https://www.sii.cl/aprenda_sobre_impuestos/impuestos/impuestos_indirectos.htm" target="_blank" rel="noreferrer">Cómo funciona el IVA · SII ↗</a>
      </section>
      <details><summary>Envío y comparación con tu precio actual</summary><div className="pricing-fields">{field('shippingCost', 'Envío que tú pagas ($)')}{field('shippingCharged', 'Envío cobrado al cliente ($)', 'Se suma al cobro y se incluye en la base de comisión e IVA de esta simulación.')}{field('currentPrice', 'Precio actual del producto ($)', 'Opcional. Precio final, sin sumar el envío.')}</div></details>
    </div><aside className="pricing-result" aria-label="Resultado de la simulación">
      {!ready && <p>Completa costos, ganancia deseada, comisión y tratamiento de IVA para ver el resultado.</p>}
      {error && <p role="alert">{error}</p>}
      {result && suggested !== null && <><span>Precio sugerido al cliente</span><strong className="pricing-total">{money(suggested)}</strong><p>Precio final del producto{tax === 'iva' ? ', IVA incluido' : ''}. Redondeado hacia arriba a $100.</p>
        <dl><div><dt>Total cobrado, con envío</dt><dd>{money(result.collected)}</dd></div><div><dt>Comisión, incluido su IVA</dt><dd>−{money(result.fees)}</dd></div><div><dt>Costos y envío que pagas</dt><dd>−{money(input.costs + input.shippingCost)}</dd></div><div><dt>Reserva para IVA</dt><dd>−{money(result.vatProvision)}</dd></div><div><dt>Reserva para renta elegida</dt><dd>−{money(result.reserve)}</dd></div><div className="pricing-pocket"><dt>Disponible estimado para ti</dt><dd>{money(result.pocket)}</dd></div>
        {chargeByHour && <><div><dt>De ese saldo, pago por tu tiempo</dt><dd>{money(result.timePay)}</dd></div><div><dt>Resto después de valorar tu tiempo</dt><dd>{money(result.afterTime)}</dd></div></>}</dl>
        <p>El disponible incluye tu ganancia deseada{chargeByHour ? ' y el pago por tu trabajo' : ''}. No equivale a una utilidad neta tributaria definitiva.</p>
        {current && <div className="pricing-comparison"><h3>Con tu precio actual</h3><p>Te quedarían <b>{money(current.pocket)}</b> después de los costos y reservas ingresados.</p><p>{current.pocket >= result.timePay + input.extraProfit ? 'Alcanza tu objetivo.' : `Faltan ${money(result.timePay + input.extraProfit - current.pocket)} para tu objetivo por venta.`}</p></div>}
      </>}
      <small>Las tarifas no se actualizan automáticamente. Confirma la comisión de Checkout en tu cuenta de Mercado Pago, incluidas cuotas o promociones aplicables. Cálculo orientativo; no emite boletas ni declara impuestos.</small>
    </aside></div>
  </section>;
}
