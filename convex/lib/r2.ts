import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export function createR2Client(): { client: S3Client; bucketName: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME must be set"
    )
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return { client, bucketName }
}

export async function generateSignedDownloadUrl(
  objectKey: string,
  filename: string,
  contentType: string = "application/octet-stream"
): Promise<string> {
  const { client, bucketName } = createR2Client()

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
    ResponseContentType: contentType,
  })

  // URL expires in 1 hour (3600 seconds)
  return await getSignedUrl(client, command, { expiresIn: 3600 })
}
