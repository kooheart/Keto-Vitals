export default function Loading() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-6 h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card overflow-hidden"><div className="skeleton aspect-square rounded-none" /><div className="space-y-2 p-3.5"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-5 w-1/2" /></div></div>
        ))}
      </div>
    </div>
  );
}
