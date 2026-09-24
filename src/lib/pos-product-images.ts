import { createClient } from "@/lib/supabase/client";

const BUCKET = "assets";
const FOLDER = "pos-products";
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_DIMENSION = 1200;
const TARGET_BYTES = 450 * 1024;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image."))),
      "image/webp",
      quality,
    );
  });
}

export async function compressProductImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Image must be 12 MB or smaller.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let blob = await canvasBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.46) {
    quality -= 0.08;
    blob = await canvasBlob(canvas, quality);
  }
  return new File([blob], "product.webp", {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export async function uploadProductImage(file: File) {
  const compressed = await compressProductImage(file);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in before uploading a product image.");

  const path = `${FOLDER}/${user.id}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function productImageStoragePath(url?: string | null) {
  if (!url) return null;
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const pathname = new URL(url).pathname;
    const index = pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(pathname.slice(index + marker.length));
    return path.startsWith(`${FOLDER}/`) ? path : null;
  } catch {
    return null;
  }
}

export async function deleteProductImage(url?: string | null) {
  const path = productImageStoragePath(url);
  if (!path) return;
  const { error } = await createClient().storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
