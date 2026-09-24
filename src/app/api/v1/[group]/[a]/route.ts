import { NextRequest } from "next/server";
import { runApi } from "@/lib/api-router";

export const dynamic = "force-dynamic";

const mk = (req: NextRequest, ctx: { params: Promise<{ group: string; a: string }> }) =>
  ctx.params.then(({ group, a }) => runApi(req, [group, a]));

export const GET = mk;
export const POST = mk;
export const PUT = mk;
export const PATCH = mk;
export const DELETE = mk;
