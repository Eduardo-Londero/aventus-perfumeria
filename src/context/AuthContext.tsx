"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, UserRole } from "@/types/auth";
import { useToast } from "./ToastContext";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: {
    name: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "aventus-auth";
const USERS_KEY = "aventus-users";

// Usuario admin por defecto (en producción esto vendría de la BD)
const DEFAULT_ADMIN: User & { password: string } = {
  id: "admin-1",
  name: "Admin",
  lastName: "Aventus",
  email: process.env.ADMIN_EMAIL || "admin@aventusperfumeria.com",
  phone: "11 2345-6789",
  role: "admin",
  password: process.env.ADMIN_PASSWORD || "admin123",
  createdAt: new Date().toISOString(),
};

// Cliente de prueba
const DEFAULT_CUSTOMER: User & { password: string } = {
  id: "customer-1",
  name: "María",
  lastName: "González",
  email: "maria@email.com",
  phone: "11 2345-6789",
  role: "customer",
  password: "cliente123",
  createdAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  // Cargar sesión al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
      }
    } catch {
      // Error al cargar sesión
    }
    setIsLoading(false);
  }, []);

  // Guardar sesión cuando cambia
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);

      // Simular delay de red
      await new Promise((resolve) => setTimeout(resolve, 800));

      try {
        // Verificar si es el admin por defecto
        if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
          const { password: _, ...adminUser } = DEFAULT_ADMIN;
          setUser(adminUser);
          showToast("Bienvenido, administrador", "success");
          setIsLoading(false);
          return true;
        }

        // Verificar si es el cliente de prueba
        if (
          email === DEFAULT_CUSTOMER.email &&
          password === DEFAULT_CUSTOMER.password
        ) {
          const { password: _, ...customerUser } = DEFAULT_CUSTOMER;
          setUser(customerUser);
          showToast(`Bienvenido, ${customerUser.name}`, "success");
          setIsLoading(false);
          return true;
        }

        // Buscar en usuarios registrados
        const usersData = localStorage.getItem(USERS_KEY);
        const users: (User & { password: string })[] = usersData
          ? JSON.parse(usersData)
          : [];

        const foundUser = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (foundUser) {
          const { password: _, ...userData } = foundUser;
          setUser(userData);
          showToast(`Bienvenido, ${userData.name}`, "success");
          setIsLoading(false);
          return true;
        }

        showToast("Email o contraseña incorrectos", "error");
        setIsLoading(false);
        return false;
      } catch {
        showToast("Error al iniciar sesión", "error");
        setIsLoading(false);
        return false;
      }
    },
    [showToast]
  );

  const register = useCallback(
    async (data: {
      name: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
    }): Promise<boolean> => {
      setIsLoading(true);

      await new Promise((resolve) => setTimeout(resolve, 800));

      try {
        const usersData = localStorage.getItem(USERS_KEY);
        const users: (User & { password: string })[] = usersData
          ? JSON.parse(usersData)
          : [];

        // Verificar si el email ya existe
        if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
          showToast("Ya existe una cuenta con este email", "error");
          setIsLoading(false);
          return false;
        }

        const newUser: User & { password: string } = {
          id: `user-${Date.now()}`,
          name: data.name,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          role: "customer" as UserRole,
          password: data.password,
          createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));

        const { password: _, ...userData } = newUser;
        setUser(userData);
        showToast("Cuenta creada exitosamente", "success");
        setIsLoading(false);
        return true;
      } catch {
        showToast("Error al crear la cuenta", "error");
        setIsLoading(false);
        return false;
      }
    },
    [showToast]
  );

  const logout = useCallback(() => {
    // Limpiar estado de React
    setUser(null);
    // Limpiar solo la sesión actual, NO los usuarios registrados
    localStorage.removeItem(STORAGE_KEY);
    // Limpiar carrito y favoritos del usuario
    localStorage.removeItem("aventus-cart");
    localStorage.removeItem("aventus-favorites");
    // Limpiar cualquier otro estado residual
    sessionStorage.clear();
    showToast("Sesión cerrada", "info");
  }, [showToast]);

  const updateProfile = useCallback(
    (data: Partial<User>) => {
      if (!user) return;

      const updatedUser = { ...user, ...data };
      setUser(updatedUser);

      // Actualizar en la lista de usuarios
      const usersData = localStorage.getItem(USERS_KEY);
      const users: (User & { password: string })[] = usersData
        ? JSON.parse(usersData)
        : [];

      const userIndex = users.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...data };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }

      showToast("Perfil actualizado correctamente", "success");
    },
    [user, showToast]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));

      try {
        const usersData = localStorage.getItem(USERS_KEY);
        const users: (User & { password: string })[] = usersData
          ? JSON.parse(usersData)
          : [];

        const userIndex = users.findIndex((u) => u.id === user?.id);
        if (userIndex === -1) {
          showToast("Usuario no encontrado", "error");
          setIsLoading(false);
          return false;
        }

        if (users[userIndex].password !== currentPassword) {
          showToast("La contraseña actual es incorrecta", "error");
          setIsLoading(false);
          return false;
        }

        users[userIndex].password = newPassword;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));

        showToast("Contraseña actualizada correctamente", "success");
        setIsLoading(false);
        return true;
      } catch {
        showToast("Error al cambiar la contraseña", "error");
        setIsLoading(false);
        return false;
      }
    },
    [user, showToast]
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<boolean> => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));

      // En producción, aquí se enviaría un email con el token de recuperación
      // Por ahora, simplemente simulamos que se envió
      showToast(
        "Si el email existe, recibirás un enlace de recuperación",
        "success"
      );
      setIsLoading(false);
      return true;
    },
    [showToast]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
