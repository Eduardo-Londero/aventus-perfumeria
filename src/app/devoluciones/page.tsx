export default function DevolucionesPage() {
  return (
    <div className="min-h-screen bg-cream-50 py-12">
      <div className="container-aventus max-w-3xl">
        <h1 className="font-serif text-3xl text-charcoal-900 mb-6">Cambios y Devoluciones</h1>
        <div className="space-y-4 text-charcoal-700 text-sm leading-relaxed">
          <p>Aceptamos cambios y devoluciones dentro de los 10 días corridos desde la recepción del producto, conforme a la Ley 24.240.</p>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">Condiciones</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>El producto debe estar sin uso, en su envase original y con todos sus accesorios.</li>
            <li>Los perfumes abiertos o usados no admiten devolución por razones de higiene.</li>
            <li>Debe presentarse el comprobante de compra.</li>
          </ul>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">Proceso</h2>
          <p>Escribinos por WhatsApp indicando tu número de pedido y el motivo. Te indicaremos los pasos para el envío del producto y la reposición o reembolso.</p>
          <h2 className="font-serif text-xl text-charcoal-900 mt-6">Costos de envío</h2>
          <p>Los costos de envío por devolución corren por cuenta del cliente, salvo que el producto presente un defecto de fábrica.</p>
          <p className="text-xs text-charcoal-500 mt-8">Última actualización: 2026.</p>
        </div>
      </div>
    </div>
  );
}