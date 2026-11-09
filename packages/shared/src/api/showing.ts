/** `GET /api/showing`: whether showing mode is on, and the projects: every stored one while off, the picked ones
 * while on, each by its key and its name (an alias while on). */
export type ShowingResponse = { on: boolean; projects: { key: string; name: string; picked: boolean }[] };

/** `POST /api/showing`'s body: the keys of the projects to show; an empty list turns showing mode off. */
export type ShowingRequest = { projects: string[] };
