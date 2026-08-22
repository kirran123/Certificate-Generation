import { cronJobs } from "convex/server";

const crons = cronJobs();

// Form polling is handled by Render Node.js backend (backend/jobs/formPoller.js)
// Disabled Convex cron job to prevent function call limits.

export default crons;
