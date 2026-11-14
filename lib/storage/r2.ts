import { AwsClient } from "aws4fetch"

/**
 * Cloudflare R2 access for product images.
 *
 * R2 speaks the S3 protocol; requests are signed with aws4fetch. Files are
 * uploaded by the admin's browser straight to R2 through a short-lived signed
 * URL, so image bytes never pass through this app.
 */
type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
}

const UPLOAD_URL_TTL_SECONDS = 300

function getConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
  }
}

function requireConfig() {
  const config = getConfig()
  if (!config) throw new Error("R2 storage is not configured")
  return config
}

function createClient(config: R2Config) {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  })
}

function objectUrl(config: R2Config, key: string) {
  const path = key.split("/").map(encodeURIComponent).join("/")
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${path}`
}

export function isStorageConfigured() {
  return getConfig() !== null
}

/** Public address of a stored image, or null while storage is not configured. */
export function getPublicImageUrl(key: string) {
  const config = getConfig()
  return config ? `${config.publicBaseUrl}/${key}` : null
}

/**
 * Signed URL the browser can PUT one file to. The content type is part of the
 * signature, so the upload must send exactly that Content-Type header.
 */
export async function createUploadUrl(key: string, contentType: string) {
  const config = requireConfig()
  const url = new URL(objectUrl(config, key))
  url.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_TTL_SECONDS))

  const signed = await createClient(config).sign(
    new Request(url, { method: "PUT", headers: { "content-type": contentType } }),
    { aws: { signQuery: true, allHeaders: true } }
  )

  return signed.url
}

/** Size and type of a stored object, or null when it does not exist. */
export async function getObjectInfo(key: string) {
  const config = requireConfig()
  const response = await createClient(config).fetch(objectUrl(config, key), {
    method: "HEAD",
  })

  if (response.status === 404) return null
  if (!response.ok) throw new Error(`R2 HEAD failed with ${response.status}`)

  return {
    size: Number(response.headers.get("content-length") ?? 0),
    contentType: response.headers.get("content-type") ?? "",
  }
}

export async function deleteObject(key: string) {
  const config = requireConfig()
  const response = await createClient(config).fetch(objectUrl(config, key), {
    method: "DELETE",
  })

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 DELETE failed with ${response.status}`)
  }
}
