import Image from "next/image";

/** SVG artwork is served as-is (no optimiser); uploaded JPEG/PNG/WebP go through next/image. */
export function ProductImage({ src, alt, sizes = "(min-width:1024px) 25vw, 50vw", priority = false, className = "" }: { src: string | null | undefined; alt: string; sizes?: string; priority?: boolean; className?: string }) {
  if (!src) return <div className={`flex h-full w-full items-center justify-center bg-ink-100 text-xs text-ink-400 ${className}`}>No image</div>;
  if (src.endsWith(".svg"))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={`h-full w-full object-cover ${className}`} />;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
}
