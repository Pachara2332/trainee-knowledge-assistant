import { createSchedule, getSchedules } from "../../../../../lib/agent/scheduler";
import { auth } from "../../../../../lib/auth";
import {
  WorkspacePermissionError,
  assertMember,
} from "../../../../../lib/workspace/workspace";

export const runtime = "nodejs";

function getUserId(session: { user?: { id?: unknown } } | null) {
  return session?.user && "id" in session.user && typeof session.user.id === "string"
    ? session.user.id
    : null;
}

function forbidden(error: unknown) {
  return error instanceof WorkspacePermissionError
    ? Response.json({ error: "Forbidden" }, { status: 403 })
    : null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await assertMember(id, userId);
    return Response.json({ schedules: await getSchedules(id) });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }

    console.error("[workspace-schedules] list failed", error);
    return Response.json(
      { error: "Unable to load workspace schedules." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await assertMember(id, userId);

    const body = await request.json().catch(() => ({}));
    const name = readText(body.name);
    const prompt = readText(body.prompt);
    const cron = readText(body.cron);

    if (!name || !prompt || !cron) {
      return Response.json(
        { error: "Name, prompt, and cron are required." },
        { status: 400 },
      );
    }

    return Response.json(
      { schedule: await createSchedule(id, userId, name, prompt, cron) },
      { status: 201 },
    );
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }

    if (error instanceof Error && error.message.includes("Cron")) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error("[workspace-schedules] create failed", error);
    return Response.json(
      { error: "Unable to create workspace schedule." },
      { status: 500 },
    );
  }
}
