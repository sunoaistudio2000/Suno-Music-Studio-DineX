import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { readFile } from "fs/promises";
import path from "path";
import { AUDIO_DIR, isSafeFilename } from "@/lib/audio";

const FILE_UPLOAD_URL = "https://kieai.redpandaai.co/api/file-stream-upload";

/**
 * Upload a file to KIE file storage.
 *
 * Accepts either:
 *   - A file via multipart/form-data (field "file")
 *   - A local filename via form field "localFilename" (reads from audio/ folder on server)
 *
 * Used by both Upload & Extend and Upload & Cover.
 */
export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to upload files" },
      { status: 401 }
    );
  }

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  // Determine the source: direct file upload or local filename
  const file = formData.get("file");
  const localFilename = formData.get("localFilename");

  let uploadBlob: Blob;
  let uploadFileName: string;

  if (file && file instanceof Blob && file.size > 0) {
    // Direct file upload from the client
    const isMp3ByMime = file.type === "audio/mpeg" || file.type === "audio/mp3";
    const isMp3ByName = file instanceof File && file.name?.toLowerCase().endsWith(".mp3");
    if (!isMp3ByMime && !isMp3ByName) {
      return NextResponse.json(
        { error: "Only MP3 files are allowed" },
        { status: 422 }
      );
    }
    uploadBlob = file;
    uploadFileName = file instanceof File && file.name ? file.name : "upload.mp3";
  } else if (typeof localFilename === "string" && localFilename.trim()) {
    // Read from the local audio/ folder
    const fname = localFilename.trim();
    if (!isSafeFilename(fname)) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 422 }
      );
    }
    const filePath = path.join(AUDIO_DIR, fname);
    if (!filePath.startsWith(AUDIO_DIR)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 422 }
      );
    }
    try {
      const buffer = await readFile(filePath);
      uploadBlob = new Blob([buffer], { type: "audio/mpeg" });
      uploadFileName = fname;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return NextResponse.json(
          { error: "Local file not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to read local file" },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "No file or localFilename provided" },
      { status: 422 }
    );
  }

  // Build the forwarded form data for KIE
  const forwardData = new FormData();
  forwardData.append("file", uploadBlob, uploadFileName);
  forwardData.append("uploadPath", "suno-studio/uploads");
  forwardData.append("fileName", uploadFileName);

  const res = await fetch(FILE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: forwardData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.code !== 200) {
    const msg =
      typeof data.msg === "string" ? data.msg : "File upload failed";
    return NextResponse.json(
      { error: msg },
      { status: res.ok ? 502 : res.status }
    );
  }

  const downloadUrl = data.data?.downloadUrl;
  const fileName = data.data?.fileName;

  if (!downloadUrl) {
    return NextResponse.json(
      { error: "No download URL in response" },
      { status: 502 }
    );
  }

  return NextResponse.json({ downloadUrl, fileName });
}
