/** `GET /api/status`: the last import attempt and the last good one (ISO times), the last attempt's error, if any. */
export type StatusResponse = {
  lastImportAt: string | null;
  lastGoodImportAt: string | null;
  error: string | null;
  importing: boolean;
};
