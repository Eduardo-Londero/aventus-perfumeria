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
import { dbOrders } from "@/lib/db";
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
  }) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  isLoading: boolean;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    // Initialize database
    const { initializeDatabase } = require("@/lib/db");
    initializeDatabase();
    setOrders(dbOrders.getAll());
    setIsLoading(false);
  }, []);

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
    (data: {
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
    }): Order => {
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
      dbOrders.updateStatus(id, status);
      setOrders(dbOrders.getAll());
      showToast(`Estado actualizado a "${status}"`, "success");
    },
    [showToast]
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
