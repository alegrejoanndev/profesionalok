import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Almacenamiento en disco local (carpeta ./storage). Sirve para desarrollo y para un servidor
 * con disco persistente. En hosting serverless (Vercel, etc.) el disco NO persiste: cambiá estas
 * 4 funciones por S3 / Cloudflare R2 / Supabase Storage y el resto del código no cambia.
 *
 *  - photos/<id>.webp         → fotos de perfil, públicas (se sirven por /api/foto/<id>)
 *  - private/titles/<id>.<ext> → títulos: privados, solo los ve el panel /admin
 */
const ROOT = process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function put(rel: string, data: Buffer) {
  const full = path.join(ROOT, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** Recorta a cuadrado 600×600, corrige la orientación, quita metadatos (EXIF/GPS) y convierte a WebP. */
export async function savePhoto(id: string, input: Buffer): Promise<string> {
  const out = await sharp(input).rotate().resize(600, 600, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  await put(`photos/${id}.webp`, out);
  return `/api/foto/${id}?v=${Date.now()}`;
}

export async function readPhoto(id: string): Promise<Buffer | null> {
  if (!UUID.test(id)) return null;
  return readFile(path.join(ROOT, 'photos', `${id}.webp`)).catch(() => null);
}

export async function saveTitle(id: string, input: Buffer, ext: 'pdf' | 'jpg' | 'png' | 'webp'): Promise<string> {
  const rel = `private/titles/${id}.${ext}`;
  await put(rel, input);
  return rel;
}

export async function readTitle(rel: string): Promise<Buffer | null> {
  if (!/^private\/titles\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(rel)) return null;
  return readFile(path.join(ROOT, rel)).catch(() => null);
}
