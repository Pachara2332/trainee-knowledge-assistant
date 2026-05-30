import {
  deleteSchedule,
  updateSchedule,
  type SchedulePatch,
} from "../../../../../../lib/agent/scheduler";
import { auth } from "../../../../../../lib/auth";
import {
  WorkspacePermissionError,
  assertMember,
} from "../../../../../../lib/workspace/workspace";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, scheduleId } = await params;
    await assertMember(id, userId);

    const body = await request.json().catch(() => ({}));
    const patch: SchedulePatch = {};

    if (typeof body.name === "string") {
      patch.name = body.name;
    }

    if (typeof body.prompt === "string") {
      patch.prompt = body.prompt;
    }

    if (typeof body.cron === "string") {
      patch.cron = body.cron;
    }

    if (typeof body.enabled === "boolean") {
      patch.enabled = body.enabled;
    }

    return Response.json({
      schedule: await updateSchedule(scheduleId, id, patch),
    });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }

    if (error instanceof Error) {
      const status =
        error.message.includes("Cron") ||
        error.message.includes("required") ||
        error.message.includes("No schedule")
          ? 400
          : error.message.includes("not found")
            ? 404
            : 500;

      if (status !== 500) {
        return Response.json({ error: error.message }, { status });
      }
    }

    console.error("[workspace-schedules] update failed", error);
    return Response.json(
      { error: "Unable to update workspace schedule." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const session = await auth();
  const userId = getUserId(session);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, scheduleId } = await params;
    await assertMember(id, userId);
    await deleteSchedule(scheduleId, id);
    return Response.json({ ok: true });
  } catch (error) {
    const response = forbidden(error);
    if (response) {
      return response;
    }

    console.error("[workspace-schedules] delete failed", error);
    return Response.json(
      { error: "Unable to delete workspace schedule." },
      { status: 500 },
    );
  }
}
