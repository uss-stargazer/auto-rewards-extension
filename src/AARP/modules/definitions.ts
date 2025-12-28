import * as z from "zod";

export class NotLoggedInError extends Error {
  name: string = "NotLoggedInError";
  loginUrl: string;

  constructor(message: string, loginUrl: string) {
    super(message);
    this.loginUrl = loginUrl;
  }
}

export interface AarpUser {
  username: string;
  fedId: string;
  accessToken: string;
}

export interface AarpActivity {
  type: "video" | "quiz";
  id: string;
  url: string;
}

export const RewardsResponseSchema = z.object({
  activityCompleted: z.uuid(),
  pointsEarned: z.number(),
  userDailyPointsLeft: z.number(),
  awarded: z.boolean(),
  success: z.boolean(),
});
