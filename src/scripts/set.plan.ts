import "@models/index";
import "reflect-metadata";
import { isPlanName, PLAN_NAMES } from "@config/plans";
import * as UserDAL from "@dal/user.dal";
import * as PlanService from "@services/plan.service";
import { db } from "@config/db.config";
import { redis } from "@config/redis.connection.config";

// npm run plan -- <email> <free|pro> [--end-trial]....
const [email, planName, ...flags] = process.argv.slice(2);

async function main(): Promise<void> {
  if (!email || !planName || !isPlanName(planName)) {
    console.log(`Usage: npm run plan -- <email> <${PLAN_NAMES.join("|")}> [--end-trial]`);
    process.exitCode = 1;
    return;
  }

  const user = await UserDAL.findUserByEmail(email);
  if (!user) {
    console.log(`No user with email ${email}`);
    process.exitCode = 1;
    return;
  }

  await UserDAL.updatePlan(user.getId(), {
    plan: planName,
    trialEndsAt: flags.includes("--end-trial") ? null : undefined,
  });

  const updated = await UserDAL.findUserByEmail(email);
  const plan = PlanService.getAccountPlan(updated!);
  const usage = await PlanService.getAccountUsage(updated!);
  console.log(
    `${email}: ${plan.name}${plan.isTrial ? " (trial)" : ""}, ${usage.projects}/${plan.limits.projects} projects, ${usage.activeDevices}/${plan.limits.devices} active devices, ${usage.waitingDevices} waiting`,
  );
}

try {
  await main();
} finally {
  await db.close();
  redis.disconnect();
}
