export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-charcoal-200 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm tracking-widest2 uppercase text-charcoal-400">
          Cargando
        </p>
      </div>
    </div>
  );
}
