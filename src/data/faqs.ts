/**
 * Datos mock de preguntas frecuentes
 * ==================================
 * FAQs de prueba para visualizar correctamente la tienda.
 *
 * IMPORTANTE: Todas las respuestas son contenido provisional
 * y están claramente identificadas como pendientes de
 * confirmación por parte de Aventus Perfumería.
 */

import { FAQ } from "@/types";

const PENDING_NOTE =
  "Información pendiente de confirmación por parte de Aventus Perfumería.";

export const faqs: FAQ[] = [
  {
    id: "1",
    question: "¿Los perfumes son 100% originales?",
    answer: `Sí, en Aventus Perfumería trabajamos exclusivamente con productos originales y auténticos. Todas nuestras fragancias provienen de distribuidores oficiales y cuentan con garantía de autenticidad.

⚠️ ${PENDING_NOTE}`,
    category: "productos",
  },
  {
    id: "2",
    question: "¿Cuánto tarda el envío?",
    answer: `Los tiempos de envío dependen de tu ubicación:

- CABA y Gran Buenos Aires: 1 a 3 días hábiles
- Interior del país: 3 a 7 días hábiles

Los pedidos realizados antes de las 14:00 hs se despachan el mismo día.

⚠️ ${PENDING_NOTE}`,
    category: "envios",
  },
  {
    id: "3",
    question: "¿Puedo retirar mi pedido por el local?",
    answer: `Sí, ofrecemos la opción de retiro en local. Una vez que tu pedido esté preparado, te avisaremos por WhatsApp o correo electrónico para que puedas retirarlo en nuestro horario de atención.

📍 Dirección del local: Pendiente de confirmación

⚠️ ${PENDING_NOTE}`,
    category: "envios",
  },
  {
    id: "4",
    question: "¿Qué medios de pago aceptan?",
    answer: `Aceptamos los siguientes medios de pago:

- Tarjetas de crédito y débito
- Transferencia bancaria
- Efectivo en el local

⚠️ ${PENDING_NOTE}`,
    category: "pagos",
  },
  {
    id: "5",
    question: "¿Puedo hacer consultas por WhatsApp?",
    answer: `¡Por supuesto! Nuestro equipo de atención al cliente está disponible para ayudarte con consultas sobre productos, pedidos, envíos y cualquier otra inquietud.

📱 Número de WhatsApp: Pendiente de confirmación

Horario de atención: Pendiente de confirmación

⚠️ ${PENDING_NOTE}`,
    category: "atencion",
  },
  {
    id: "6",
    question: "¿Cuál es la política de cambios y devoluciones?",
    answer: `Queremos que estés 100% satisfecho con tu compra. Nuestra política de cambios y devoluciones incluye:

- Cambios dentro de los 30 días de realizada la compra
- El producto debe estar sin usar y en su empaque original
- No aplica en productos en oferta o liquidación

⚠️ ${PENDING_NOTE}`,
    category: "cambios",
  },
];

export const getFAQsByCategory = (category: string): FAQ[] => {
  return faqs.filter((f) => f.category === category);
};
