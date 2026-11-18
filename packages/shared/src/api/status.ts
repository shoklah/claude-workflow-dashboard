/** `GET /api/status`: the last import attempt and the last good one (ISO times), the last attempt's error, if any, and
 * in hosted mode the caller's account (null in local mode; absent reads as local): its login, the login of the account
 * it views (null for its own), the logins of the accounts it may view and whether it is the admin (`EDWARD_ADMIN`'s
 * login). */
export type StatusResponse = {
  lastImportAt: string | null;
  lastGoodImportAt: string | null;
  error: string | null;
  importing: boolean;
  account?: { login: string; viewing: string | null; viewable: string[]; admin: boolean } | null;
};
