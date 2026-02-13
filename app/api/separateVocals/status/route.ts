import { NextRequest, NextResponse } from "next/server";

const KIE_BASE = "https://api.kie.ai/api/v1";

export async function GET(request: NextRequest) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${KIE_BASE}/vocal-removal/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(
      { error: data.msg || data.error || "KIE API error", code: data.code },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }

  return NextResponse.json(data);
}
