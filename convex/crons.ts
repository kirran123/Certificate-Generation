import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Poll active Google Sheet automations every 10 minutes
crons.interval("form-poller", { minutes: 10 }, internal.formPoller.pollAll);

export default crons;
