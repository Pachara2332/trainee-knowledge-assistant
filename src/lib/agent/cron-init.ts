import { runDueSchedules } from "./cron-worker";

const globalForAgentCron = globalThis as typeof globalThis & {
  agentCronInitialized?: boolean;
  agentCronRunning?: boolean;
  agentCronInterval?: ReturnType<typeof setInterval>;
};

export function initCron() {
  if (globalForAgentCron.agentCronInitialized) {
    return;
  }

  globalForAgentCron.agentCronInitialized = true;
  const interval = setInterval(async () => {
    if (globalForAgentCron.agentCronRunning) {
      return;
    }

    globalForAgentCron.agentCronRunning = true;
    try {
      await runDueSchedules();
    } catch (error) {
      console.error("[agent-cron] tick failed", error);
    } finally {
      globalForAgentCron.agentCronRunning = false;
    }
  }, 60_000);

  globalForAgentCron.agentCronInterval = interval;
  (interval as NodeJS.Timeout).unref?.();
}
