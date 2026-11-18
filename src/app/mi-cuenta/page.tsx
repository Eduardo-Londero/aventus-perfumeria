"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

type Tab = "datos" | "direccion" | "pedidos" | "favoritos" | "seguridad";

export default function MiCuentaPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, updateProfile, changePassword, logout } =
    useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("datos");

  // Form states
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
  });

  const [addressForm, setAddressForm] = useState({
    address: user?.address || "",
    city: user?.city || "",
    postalCode: user?.postalCode || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // El perfil llega asíncrono (Supabase Auth + tabla profiles): los
  // useState de arriba corrieron con user=null, así que al resolverse la
  // sesión se pueblan los forms. El disparador es el ID (cambia solo al
  // iniciar o cambiar de cuenta): una actualización de perfil posterior no
  // pisa lo que el usuario esté escribiendo.
  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user.name || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
    });
    setAddressForm({
      address: user.address || "",
      city: user.city || "",
      postalCode: user.postalCode || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Redirect if not authenticated
  if (!isLoading && !isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-charcoal-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const handleProfileSave = () => {
    updateProfile(profileForm);
  };

  const handleAddressSave = () => {
    updateProfile(addressForm);
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("Las contraseñas no coinciden", "error");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showToast("La contraseña debe tener al menos 6 caracteres", "error");
      return;
    }
    const success = await changePassword(
      passwordForm.currentPassword,
      passwordForm.newPassword
    );
    if (success) {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    {
      id: "datos",
      label: "Datos personales",
      icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    },
    {
      id: "direccion",
      label: "Dirección",
      icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      id: "pedidos",
      label: "Mis pedidos",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    },
    {
      id: "favoritos",
      label: "Mis favoritos",
      icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    },
    {
      id: "seguridad",
      label: "Seguridad",
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    },
  ];

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="bg-charcoal-950 text-cream-50 py-16">
        <div className="container-aventus">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
            Mi cuenta
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">
            Hola, {user.name}
          </h1>
          <p className="text-cream-50/70 max-w-2xl">
            Gestioná tus datos, pedidos y favoritos desde aquí.
          </p>
        </div>
      </div>

      <div className="container-aventus py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-charcoal-100 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-charcoal-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gold-100 rounded-full flex items-center justify-center">
                    <span className="font-serif text-xl text-gold-700">
                      {user.name.charAt(0)}
                      {user.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-charcoal-900">
                      {user.name} {user.lastName}
                    </p>
                    <p className="text-sm text-charcoal-500">{user.email}</p>
                  </div>
                </div>
              </div>
              <nav className="p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? "bg-gold-50 text-gold-700"
                        : "text-charcoal-600 hover:bg-cream-50"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d={tab.icon}
                      />
                    </svg>
                    {tab.label}
                  </button>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Cerrar sesión
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {/* Datos personales */}
            {activeTab === "datos" && (
              <div className="bg-white border border-charcoal-100 rounded-lg p-8">
                <h2 className="font-serif text-xl text-charcoal-900 mb-6">
                  Datos personales
                </h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, name: e.target.value })
                      }
                      className="input-aventus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Apellido
                    </label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          lastName: e.target.value,
                        })
                      }
                      className="input-aventus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                      className="input-aventus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="input-aventus bg-cream-50 text-charcoal-400"
                    />
                    <p className="text-xs text-charcoal-500 mt-1">
                      El email no puede ser modificado
                    </p>
                  </div>
                  <button onClick={handleProfileSave} className="btn-primary">
                    Guardar cambios
                  </button>
                </div>
              </div>
            )}

            {/* Dirección */}
            {activeTab === "direccion" && (
              <div className="bg-white border border-charcoal-100 rounded-lg p-8">
                <h2 className="font-serif text-xl text-charcoal-900 mb-6">
                  Dirección de envío
                </h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={addressForm.address}
                      onChange={(e) =>
                        setAddressForm({ ...addressForm, address: e.target.value })
                      }
                      className="input-aventus"
                      placeholder="Calle y número"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-charcoal-600 mb-1.5">
                        Ciudad
                      </label>
                      <input
                        type="text"
                        value={addressForm.city}
                        onChange={(e) =>
                          setAddressForm({ ...addressForm, city: e.target.value })
                        }
                        className="input-aventus"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-charcoal-600 mb-1.5">
                        Código postal
                      </label>
                      <input
                        type="text"
                        value={addressForm.postalCode}
                        onChange={(e) =>
                          setAddressForm({
                            ...addressForm,
                            postalCode: e.target.value,
                          })
                        }
                        className="input-aventus"
                      />
                    </div>
                  </div>
                  <button onClick={handleAddressSave} className="btn-primary">
                    Guardar dirección
                  </button>
                </div>
              </div>
            )}

            {/* Mis pedidos */}
            {activeTab === "pedidos" && (
              <div className="bg-white border border-charcoal-100 rounded-lg p-8">
                <h2 className="font-serif text-xl text-charcoal-900 mb-6">
                  Mis pedidos
                </h2>
                <p className="text-charcoal-600 mb-4">
                  Ver tu historial de compras
                </p>
                <Link href="/mi-pedidos" className="btn-primary">
                  Ir a mis pedidos
                </Link>
              </div>
            )}

            {/* Favoritos */}
            {activeTab === "favoritos" && (
              <div className="bg-white border border-charcoal-100 rounded-lg p-8">
                <h2 className="font-serif text-xl text-charcoal-900 mb-6">
                  Mis favoritos
                </h2>
                <p className="text-charcoal-600 mb-4">
                  Ver todos tus productos guardados
                </p>
                <Link href="/favoritos" className="btn-primary">
                  Ir a mis favoritos
                </Link>
              </div>
            )}

            {/* Seguridad */}
            {activeTab === "seguridad" && (
              <div className="bg-white border border-charcoal-100 rounded-lg p-8">
                <h2 className="font-serif text-xl text-charcoal-900 mb-6">
                  Cambiar contraseña
                </h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Contraseña actual
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: e.target.value,
                        })
                      }
                      className="input-aventus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: e.target.value,
                        })
                      }
                      className="input-aventus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-600 mb-1.5">
                      Confirmar nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="input-aventus"
                    />
                  </div>
                  <button onClick={handlePasswordChange} className="btn-primary">
                    Cambiar contraseña
                  </button>
                </div>

                <div className="mt-8 pt-8 border-t border-charcoal-100">
                  <h3 className="font-medium text-charcoal-900 mb-2">
                    Recuperar contraseña
                  </h3>
                  <p className="text-sm text-charcoal-600 mb-4">
                    Si olvidaste tu contraseña, podés recuperarla usando tu
                    email.
                  </p>
                  <Link
                    href="/recuperar-password"
                    className="text-sm text-gold-600 hover:text-gold-700 font-medium"
                  >
                    Recuperar contraseña →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
