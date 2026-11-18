"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Order, OrderStatus, OrderItemSnapshot } from "@/types";
import { dbOrders, initializeDatabase } from "@/lib/db";
import { IS_SUPABASE_BACKEND } from "@/lib/dataBackend";
import {
  createRemoteOrder,
  fetchAllOrdersAdmin,
  fetchUserRemoteOrders,
  updateRemoteOrderStatus,
} from "@/lib/ordersRemote";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

interface OrdersContextType {
  orders: Order[];
  getUserOrders: (userId: string) => Order[];
  getOrderById: (id: string) => Order | undefined;
  createOrder: (data: {
    items: OrderItemSnapshot[];
    subtotal: number;
    shippingCost: number;
    total: number;
    deliveryMethod: "retiro" | "envio";
    paymentMethod: string;
    customer: {
      name: string;
      lastName: string;
      phone: string;
      email: string;
      address?: string;
      city?: string;
      postalCode?: string;
    };
  }) => Promise<Order>;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  isLoading: boolean;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  // Arranque de la capa de datos (siembra local en el modo histórico).
  useEffect(() => {
    initializeDatabase();
    if (!IS_SUPABASE_BACKEND) {
      setOrders(dbOrders.getAll());
      setIsLoading(false);
    }
    // En modo supabase la carga real la decide el efecto de "visores"
    // de abajo: depende de quién esté mirando (cliente vs. panel).
  }, []);

  /**
   * Fuente de pedidos según quién mira (solo backend `supabase`):
   *  - admin (cookie del panel) → TODOS los pedidos (/api/admin/orders,
   *    service_role: el admin no tiene sesión de Supabase Auth);
   *  - cliente autenticado      → los suyos (RLS orders_owner_read);
   *  - sin sesión               → ninguno.
   */
  const loadOrdersForViewer = useCallback(async (): Promise<Order[]> => {
    if (!IS_SUPABASE_BACKEND) return dbOrders.getAll();
    if (isAdmin) return fetchAllOrdersAdmin();
    if (user) return fetchUserRemoteOrders();
    return [];
  }, [isAdmin, user]);

  // Carga remota cuando cambia el visor (o termina la carga del auth).
  useEffect(() => {
    if (!IS_SUPABASE_BACKEND || authLoading) return;
    let cancelled = false;
    setIsLoading(true);
    loadOrdersForViewer()
      .then((list) => {
        if (!cancelled) setOrders(list);
      })
      .catch((error: unknown) => {
        console.error(
          "[orders] no se pudieron cargar los pedidos:",
          error instanceof Error ? error.message : error
        );
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, loadOrdersForViewer]);

  const getUserOrders = useCallback(
    (userId: string): Order[] => {
      return orders.filter((o) => o.userId === userId);
    },
    [orders]
  );

  const getOrderById = useCallback(
    (id: string): Order | undefined => {
      return orders.find((o) => o.id === id);
    },
    [orders]
  );

  const createOrder = useCallback(
    async (data: {
      items: OrderItemSnapshot[];
      subtotal: number;
      shippingCost: number;
      total: number;
      deliveryMethod: "retiro" | "envio";
      paymentMethod: string;
      customer: {
        name: string;
        lastName: string;
        phone: string;
        email: string;
        address?: string;
        city?: string;
        postalCode?: string;
      };
    }): Promise<Order> => {
      // ---------------------------------------------------------------
      // Backend remoto: el pedido lo crea la RPC en el servidor
      // (precios, stock y dueño los decide él). Lanza Error con mensaje
      // apto para el usuario si algo falla.
      // ---------------------------------------------------------------
      if (IS_SUPABASE_BACKEND) {
        const order = await createRemoteOrder({
          items: data.items,
          deliveryMethod: data.deliveryMethod,
          paymentMethod: data.paymentMethod,
          customer: data.customer,
        });
        setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
        showToast(`Pedido ${order.id} creado`, "success");
        return order;
      }

      // ---------------------------------------------------------------
      // localStorage (modo histórico, byte a byte igual que siempre).
      // ---------------------------------------------------------------
      const orderNumber = dbOrders.generateOrderNumber();

      const newOrder: Order = {
        id: orderNumber,
        date: new Date().toISOString(),
        customer: data.customer,
        items: data.items,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        total: data.total,
        deliveryMethod: data.deliveryMethod,
        paymentMethod: data.paymentMethod,
        status: "no-concretado",
        statusHistory: [{ status: "no-concretado", date: new Date().toISOString() }],
        userId: user?.id,
      };

      dbOrders.create(newOrder);
      setOrders(dbOrders.getAll());
      showToast(`Pedido ${orderNumber} creado`, "success");
      return newOrder;
    },
    [user, showToast]
  );

  const updateOrderStatus = useCallback(
    (id: string, status: OrderStatus) => {
      // Remoto: la transición la valida el servidor (misma máquina de
      // estados); si la rechaza responde 409 y se muestra su mensaje.
      if (IS_SUPABASE_BACKEND) {
        void updateRemoteOrderStatus(id, status)
          .then(() => {
            showToast(`Estado actualizado a "${status}"`, "success");
            return loadOrdersForViewer();
          })
          .then((list) => setOrders(list))
          .catch((error: unknown) => {
            showToast(
              error instanceof Error
                ? error.message
                : `No se pudo aplicar el estado "${status}"`,
              "error"
            );
          });
        return;
      }

      // Local: la capa de datos valida la transición; su resultado
      // determina si corresponde mostrar éxito o error.
      const applied = dbOrders.updateStatus(id, status);
      setOrders(dbOrders.getAll());
      if (applied) {
        showToast(`Estado actualizado a "${status}"`, "success");
      } else {
        showToast(
          `No se pudo aplicar el estado "${status}": transición no permitida`,
          "error"
        );
      }
    },
    [showToast, loadOrdersForViewer]
  );

  return (
    <OrdersContext.Provider
      value={{
        orders,
        getUserOrders,
        getOrderById,
        createOrder,
        updateOrderStatus,
        isLoading,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error("useOrders must be used within an OrdersProvider");
  }
  return context;
}
