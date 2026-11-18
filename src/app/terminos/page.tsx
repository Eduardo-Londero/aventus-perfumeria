export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-cream-50 py-12">
      <div className="container-aventus max-w-3xl">
        <h1 className="font-serif text-3xl text-charcoal-900 mb-6">Términos y Condiciones</h1>
        <div className="prose prose-charcoal space-y-4 text-charcoal-700 text-sm leading-relaxed">
          <p>Al utilizar este sitio y realizar compras, aceptás los siguientes términos y condiciones.</p>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">1. Productos y precios</h2>
          <p>Los precios están expresados en pesos argentinos e incluyen IVA cuando corresponda. Nos reservamos el derecho de modificar precios sin previo aviso. El stock se actualiza en tiempo real; si un producto se agota, se informará al cliente.</p>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">2. Pedidos y pagos</h2>
          <p>Los pedidos se confirman por WhatsApp. El pago se coordina con el vendedor (transferencia, efectivo o el medio acordado). El pedido se considera confirmado únicamente cuando el pago es verificado.</p>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">3. Envíos y retiros</h2>
          <p>Los envíos se realizan a todo el país a través de los transportes disponibles. Los costos y plazos se informan al confirmar el pedido. También se ofrece retiro en local.</p>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">4. Responsabilidad</h2>
          <p>No nos responsabilizamos por demoras o pérdidas ocasionadas por el transporte una vez despachado el producto. El cliente debe verificar el estado del paquete al recibirlo.</p>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">5. Contacto</h2>
          <p>Para consultas, escribinos por WhatsApp o a través del formulario de contacto.</p>
          <p className="text-xs text-charcoal-500 mt-8">Última actualización: 2026.</p>
        </div>
      </div>
    </div>
  );
}