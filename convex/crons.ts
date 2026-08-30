import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Background Google Sheet form poller is managed by local backend (backend/jobs/formPoller.js)
// Disabled Convex cloud cron to prevent dual-polling and unauthorized Key 4 dispatches
// crons.interval("form-poller", { minutes: 1 }, internal.formPoller.pollAll);

export default crons;
