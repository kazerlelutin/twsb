import { revisions } from "~/server/api.server";

export const GET = revisions.list;
export const DELETE = revisions.purge;
