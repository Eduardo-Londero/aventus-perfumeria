"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { useOrders } from "@/context/OrdersContext";
import { useAuth } from "@/context/AuthContext";
import { formatPrice, generateWhatsAppUrl } from "@/config/site";
import { computeShipping, computeSubtotal, findStockIssues } from "@/lib/pricing";
import { dbProducts, onBackendReady } from "@/lib/db";
import { IS_SUPABASE_BACKEND } from "@/lib/dataBackend";

import type { Product } from "@/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { showToast } = useToast();
  const { createOrder } = useOrders();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: user?.name || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
    email: user?.email || "",
    address: user?.address || "",
    city: user?.city || "",
    postalCode: user?.postalCode || "",
    deliveryMethod: "retiro" as "retiro" | "envio",
    paymentMethod: "transferencia" as "transferencia" | "efectivo" | "mercado_pago",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  /**
   * Con el backend `supabase` el catálogo llega por hidratación async. El
   * `useMemo` de revalidación de abajo depende de `items`; sin este tick
   * quedaría congelado con un catálogo vacío y marcaría todo como
   * "no disponible". Con el backend por defecto el tick no cambia nada.
   */
  const [catalogVersion, setCatalogVersion] = useState(0);
  useEffect(() => onBackendReady(() => setCatalogVersion((v) => v + 1)), []);

  const isDelivery = form.deliveryMethod === "envio";

  /**
   * Revalidación contra la fuente de datos (src/lib/db.ts) en cada render:
   *  - producto dado de baja o eliminado → bloquea el pedido
   *  - cantidad superior al stock vigente → bloquea el pedido
   *  - precio modificado en catálogo → se usa el precio vigente
   * Así el importe que se registra nunca depende de valores cacheados en el
   * navegador ni de lo que "crea" el cliente.
   */
  const validated = useMemo(() => {
    // `catalogVersion` solo dispara el recálculo cuando el catálogo remoto
    // termina de hidratar (con localStorage nunca cambia).
    void catalogVersion;
    const rows = items.map((item) => {
      const current: Product | undefined = dbProducts.getById(item.product.id);
      const available = current && current.isActive ? current : null;
      return { item, product: available };
    });

    const unavailable = rows
      .filter((row) => !row.product)
      .map((row) => row.item.product.name);

    const stockIssues = findStockIssues(
      rows
        .filter((row) => row.product)
        .map((row) => ({
          productId: row.item.product.id,
          quantity: row.item.quantity,
          stock: row.product?.stock ?? 0,
        }))
    );

    const lines = rows
      .filter((row) => row.product)
      .map((row) => ({ item: row.item, product: row.product as Product }));

    const priceChanged = lines.some(
      (line) => line.product.price !== line.item.product.price
    );

    const subtotal = computeSubtotal(
      lines.map((line) => ({
        price: line.product.price,
        quantity: line.item.quantity,
      }))
    );

    return { lines, unavailable, stockIssues, priceChanged, subtotal };
  }, [items, catalogVersion]);

  const subtotal = validated.subtotal;
  const shippingCost = computeShipping(subtotal, form.deliveryMethod);
  const envioOptionCost = computeShipping(subtotal, "envio");
  const total = subtotal + shippingCost;
  const hasBlockingIssues =
    validated.unavailable.length > 0 || validated.stockIssues.length > 0;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = "Nombre es requerido";
    if (!form.lastName.trim()) newErrors.lastName = "Apellido es requerido";
    if (!form.phone.trim()) newErrors.phone = "Teléfono es requerido";
    if (!form.email.trim()) {
      newErrors.email = "Email es requerido";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Email no es válido";
    }

    if (isDelivery) {
      if (!form.address.trim()) newErrors.address = "Dirección es requerida";
      if (!form.city.trim()) newErrors.city = "Ciudad es requerida";
      if (!form.postalCode.trim()) newErrors.postalCode = "Código postal es requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      showToast("Completá todos los campos requeridos", "error");
      return;
    }

    if (items.length === 0) {
      showToast("Tu carrito está vacío", "error");
      return;
    }

    if (hasBlockingIssues) {
      const names = validated.unavailable.join(", ");
      showToast(
        validated.unavailable.length > 0
          ? `Productos no disponibles: ${names}. Quitilos del carrito para continuar.`
          : "Hay productos sin stock suficiente. Ajustá las cantidades para continuar.",
        "error"
      );
      return;
    }

    // Comprar requiere cuenta (el esquema de pedidos exige user_id NOT
    // NULL y la RPC rechaza invitados): sin sesión se envía al login y,
    // con el `?next=`, se vuelve acá.
    if (IS_SUPABASE_BACKEND && !user) {
      showToast(
        "Iniciá sesión o creá una cuenta para completar la compra.",
        "info"
      );
      router.push("/login?next=/checkout");
      return;
    }

    setIsProcessing(true);

    // Snapshot de productos con los datos VIGENTES del catálogo
    const orderItems = validated.lines.map(({ item, product }) => ({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      image: product.images[0],
      size: product.size,
      concentration: product.concentration,
      quantity: item.quantity,
      unitPrice: product.price,
      subtotal: product.price * item.quantity,
    }));

    if (validated.priceChanged) {
      showToast("Algunos precios cambiaron: se aplicó el precio vigente.", "info");
    }

    // Crear el pedido en la base de datos (importes ya revalidados).
    // Si la capa de datos rechaza la operación (ID duplicado, datos
    // corruptos, etc.) se informa al usuario y se libera el botón.
    let order;
    try {
      order = await createOrder({
        items: orderItems,
        subtotal,
        shippingCost,
        total,
        deliveryMethod: form.deliveryMethod,
        paymentMethod: form.paymentMethod,
        customer: {
          name: form.name,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          postalCode: form.postalCode,
        },
      });
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "No se pudo crear el pedido. Intentá nuevamente.",
        "error"
      );
      setIsProcessing(false);
      return;
    }

    setOrderId(order.id);

    // Si el pago es por Mercado Pago, redirigir al checkout hospedado.
    if (form.paymentMethod === "mercado_pago") {
      try {
        const res = await fetch("/api/mercadopago/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNumber: order.id,
            items: orderItems.map((it) => ({
              id: it.productId,
              title: it.name,
              quantity: it.quantity,
            })),
            payerEmail: form.email,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok || !(data.redirect_url || data.init_point)) {
          throw new Error(data?.message || "No se pudo iniciar el pago con Mercado Pago.");
        }
        clearCart();
        setIsProcessing(false);
        showToast("Redirigiendo a Mercado Pago...", "info");
        window.location.href = data.redirect_url || data.init_point;
        return;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "No se pudo iniciar el pago con Mercado Pago.",
          "error"
        );
        setIsProcessing(false);
        return;
      }
    }

    clearCart();
    setIsProcessing(false);

    // Generar mensaje de WhatsApp
    const itemsMessage = orderItems
      .map((item) => `• ${item.name} — ${item.size} × ${item.quantity} — ${formatPrice(item.subtotal)}`)
      .join("\n");

    const whatsappMessage = `Hola, quiero realizar el pedido ${order.id}.

Cliente: ${form.name} ${form.lastName}
Teléfono: ${form.phone}
Email: ${form.email}

${itemsMessage}

Total: ${formatPrice(total)}
Modalidad: ${form.deliveryMethod === "envio" ? "Envío a domicilio" : "Retiro en local"}
Pago: ${form.paymentMethod === "transferencia" ? "Transferencia bancaria" : "Efectivo en el local"}`;

    // Abrir WhatsApp
    const whatsappUrl = generateWhatsAppUrl(whatsappMessage);
    window.open(whatsappUrl, "_blank");

    showToast("Pedido generado. Se abrió WhatsApp para confirmar.");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Order confirmation
  if (orderId) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white border border-charcoal-100 p-10 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-charcoal-900 mb-3">
            Pedido generado
          </h1>
          <p className="text-charcoal-600 mb-6">
            {form.paymentMethod === "mercado_pago"
              ? "Tu pedido fue creado. Serás redirigido a Mercado Pago para completar el pago."
              : "Tu pedido fue creado. Se abrió WhatsApp para que puedas confirmarlo."}
          </p>
          <div className="bg-cream-100 p-4 mb-6">
            <p className="text-xs text-charcoal-500 mb-1">Número de pedido</p>
            <p className="font-serif text-2xl font-medium text-charcoal-900">
              #{orderId}
            </p>
          </div>
          <div className="space-y-2 text-sm text-charcoal-600 mb-8">
            <p><span className="font-medium">Modalidad:</span> {isDelivery ? "Envío a domicilio" : "Retiro en local"}</p>
            <p><span className="font-medium">Pago:</span> {form.paymentMethod === "transferencia" ? "Transferencia bancaria" : "Efectivo en el local"}</p>
            <p><span className="font-medium">Total:</span> {formatPrice(total)}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/mi-cuenta" className="btn-primary">
              Ver mis pedidos
            </Link>
            <Link href="/perfumes" className="btn-secondary">
              Seguir explorando
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Empty cart
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-charcoal-900 mb-2">
            Tu carrito está vacío
          </h1>
          <Link href="/perfumes" className="btn-primary">
            Ver perfumes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="bg-charcoal-950 text-cream-50 py-12">
        <div className="container-aventus">
          <h1 className="font-serif text-3xl sm:text-4xl">Finalizar pedido</h1>
          <p className="text-cream-50/60 mt-2">
            Completá tu pedido y confirmalo por WhatsApp
          </p>
        </div>
      </div>

      <div className="container-aventus py-12">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Personal Info */}
            <div className="bg-white border border-charcoal-100 p-6">
              <h2 className="font-serif text-xl text-charcoal-900 mb-6">Datos personales</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-charcoal-600 mb-1.5">Nombre *</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className={`input-aventus ${errors.name ? "border-red-500" : ""}`}
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm text-charcoal-600 mb-1.5">Apellido *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    className={`input-aventus ${errors.lastName ? "border-red-500" : ""}`}
                  />
                  {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="block text-sm text-charcoal-600 mb-1.5">Teléfono *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={`input-aventus ${errors.phone ? "border-red-500" : ""}`}
                  />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm text-charcoal-600 mb-1.5">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={`input-aventus ${errors.email ? "border-red-500" : ""}`}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white border border-charcoal-100 p-6">
              <h2 className="font-serif text-xl text-charcoal-900 mb-6">Entrega</h2>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center gap-4 p-4 border cursor-pointer ${form.deliveryMethod === "retiro" ? "border-gold-500 bg-gold-50" : "border-charcoal-200"}`}>
                  <input type="radio" name="deliveryMethod" value="retiro" checked={form.deliveryMethod === "retiro"} onChange={handleChange} className="accent-gold-600" />
                  <div>
                    <p className="font-medium">Retiro en local</p>
                    <p className="text-xs text-charcoal-500">Gratis</p>
                  </div>
                </label>
                <label className={`flex items-center gap-4 p-4 border cursor-pointer ${form.deliveryMethod === "envio" ? "border-gold-500 bg-gold-50" : "border-charcoal-200"}`}>
                  <input type="radio" name="deliveryMethod" value="envio" checked={form.deliveryMethod === "envio"} onChange={handleChange} className="accent-gold-600" />
                  <div>
                    <p className="font-medium">Envío</p>
                    <p className="text-xs text-charcoal-500">{envioOptionCost === 0 ? "Gratis" : formatPrice(envioOptionCost)}</p>
                  </div>
                </label>
              </div>
              {isDelivery && (
                <div className="mt-6 space-y-4">
                  <input type="text" name="address" value={form.address} onChange={handleChange} placeholder="Dirección *" className={`input-aventus ${errors.address ? "border-red-500" : ""}`} />
                  {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="Ciudad *" className={`input-aventus ${errors.city ? "border-red-500" : ""}`} />
                    <input type="text" name="postalCode" value={form.postalCode} onChange={handleChange} placeholder="Código postal *" className={`input-aventus ${errors.postalCode ? "border-red-500" : ""}`} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment method */}
            <div className="bg-white border border-charcoal-100 p-6">
              <h2 className="font-serif text-xl text-charcoal-900 mb-6">Método de pago</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center gap-3 p-4 border cursor-pointer min-w-0 overflow-hidden ${form.paymentMethod === "transferencia" ? "border-gold-500 bg-gold-50" : "border-charcoal-200"}`}>
                  <input type="radio" name="paymentMethod" value="transferencia" checked={form.paymentMethod === "transferencia"} onChange={handleChange} className="accent-gold-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">Transferencia</p>
                    <p className="text-xs text-charcoal-500 truncate">Bancaria</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 border cursor-pointer min-w-0 overflow-hidden ${form.paymentMethod === "efectivo" ? "border-gold-500 bg-gold-50" : "border-charcoal-200"}`}>
                  <input type="radio" name="paymentMethod" value="efectivo" checked={form.paymentMethod === "efectivo"} onChange={handleChange} className="accent-gold-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">Efectivo</p>
                    <p className="text-xs text-charcoal-500 truncate">En el local</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 border cursor-pointer min-w-0 overflow-hidden ${form.paymentMethod === "mercado_pago" ? "border-gold-500 bg-gold-50" : "border-charcoal-200"}`}>
                  <input type="radio" name="paymentMethod" value="mercado_pago" checked={form.paymentMethod === "mercado_pago"} onChange={handleChange} className="accent-gold-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">Mercado Pago</p>
                    <p className="text-xs text-charcoal-500 truncate">Tarjetas y cuotas</p>
                  </div>
                </label>

              </div>
            </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-charcoal-100 p-6 sticky top-28">
              <h2 className="font-serif text-xl text-charcoal-900 mb-6">Resumen</h2>
              <div className="space-y-3 mb-6">
                {validated.lines.map(({ item, product }) => (
                  <div key={product.id} className="flex gap-3">
                    <div className="relative w-12 h-14 bg-cream-100 flex-shrink-0">
                      <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="48px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gold-600 uppercase">{product.brand}</p>
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-charcoal-500">{product.size} · Cant: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">{formatPrice(product.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              {/* Bloqueantes: stock o disponibilidad */}
              {hasBlockingIssues && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                  {validated.unavailable.length > 0 && (
                    <p>
                      No disponible: {validated.unavailable.join(", ")}
                      . Quitalos del carrito para continuar.
                    </p>
                  )}
                  {validated.stockIssues.length > 0 && (
                    <p>
                      Stock insuficiente en {validated.stockIssues.length}{" "}
                      {validated.stockIssues.length === 1 ? "producto" : "productos"}: revisá las cantidades.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2 pt-4 border-t border-charcoal-100">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Envío</span>
                  <span>{shippingCost === 0 ? "Gratis" : formatPrice(shippingCost)}</span>
                </div>
                <div className="flex justify-between text-lg font-medium pt-2 border-t border-charcoal-100">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing || hasBlockingIssues}
                className="w-full btn-gold mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing
                  ? "Procesando..."
                  : hasBlockingIssues
                    ? "REVISÁ EL CARRITO"
                    : form.paymentMethod === "mercado_pago"
                      ? "PAGAR CON MERCADO PAGO"
                      : "GENERAR PEDIDO Y CONFIRMAR POR WHATSAPP"}
              </button>
              <p className="text-xs text-charcoal-500 text-center mt-4">
                {form.paymentMethod === "mercado_pago"
                  ? "Serás redirigido a Mercado Pago para completar el pago"
                  : "Se abrirá WhatsApp para confirmar tu pedido"}
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
