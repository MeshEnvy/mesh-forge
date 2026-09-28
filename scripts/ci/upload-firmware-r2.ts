import { createReadStream } from "node:fs"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { createR2Client } from "../../convex/lib/r2"

const filePath = process.argv[2]
const objectKey = process.argv[3]
if (!filePath || !objectKey) {
  console.error("usage: upload-firmware-r2.ts <file> <objectKey>")
  process.exit(1)
}

const { client, bucketName } = createR2Client()
await client.send(
  new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: createReadStream(filePath),
    ContentType: "application/gzip",
  })
)
console.log(`uploaded ${objectKey} to ${bucketName}`)
