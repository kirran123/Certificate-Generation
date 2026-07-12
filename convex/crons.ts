import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Poll active Google Sheet automations every minute
crons.interval("form-poller", { minutes: 1 }, internal.formPoller.pollAll);

export default crons;
