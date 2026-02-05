/** KIE API: error is in data.msg only. Treat as error when !res.ok or when data.code !== 200. */
export type ParseKieResult =
  | { isError: false; apiCode: number }
  | { isError: true; errorMessage: string; apiCode: number; status: number };

export function parseKieResponse(
  res: Response,
  data: Record<string, unknown>
): ParseKieResult {
  const apiCode = (data.code as number | undefined) ?? res.status;
  const msg = typeof data.msg === "string" ? data.msg.trim() : "";
  const isOk = apiCode === 200;
  const errorMessage = msg || "Request failed";

  if (!res.ok || !isOk) {
    const status = !res.ok
      ? (res.status >= 400 ? res.status : 502)
      : (apiCode >= 400 ? apiCode : 502);
    return { isError: true, errorMessage, apiCode, status };
  }
  return { isError: false, apiCode };
}
