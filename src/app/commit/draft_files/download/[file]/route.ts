// /commit/draft_files/download/<file> — a fresh, short-lived S3 link to one delivered file.
//
// The delivery lives in s3://zsb-deliverables/commit/challenge-v0/ (private bucket). Files too big for
// the repo (the 461 MB matrix) are served this way: each click signs a one-hour GetObject URL and
// redirects to it, so no link outlives the visit. Gated by src/middleware.ts with the rest of
// /commit/draft_files. Needs the Vercel AWS credentials to allow s3:GetObject on that prefix.
import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = "zsb-deliverables";
const PREFIX = "commit/challenge-v0/";
// only files that are actually in the delivery can be requested
const ALLOWED = new Set(["zscape_gold_48hpf.v0.h5ad"]);

const s3 = new S3Client({
  region: "us-east-1", // the bucket's region, not the DynamoDB region in AWS_REGION
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!ALLOWED.has(file)) {
    return NextResponse.json({ error: "unknown file" }, { status: 404 });
  }
  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: PREFIX + file, ResponseContentDisposition: `attachment; filename="${file}"` }),
      { expiresIn: 3600 },
    );
    return NextResponse.redirect(url, 302);
  } catch (e) {
    return NextResponse.json({ error: "could not sign a download link", detail: String(e) }, { status: 502 });
  }
}
