import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <p className="section-subtitle mb-4">Error 404</p>
      <h1 className="section-title mb-6 text-balance">Página no encontrada</h1>
      <p className="text-charcoal-500 mb-8 max-w-md">
        La página que estás buscando no existe o fue movida.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/" className="btn-primary">
          Volver al inicio
        </Link>
        <Link href="/perfumes" className="btn-secondary">
          Ver perfumes
        </Link>
      </div>
    </div>
  );
}
