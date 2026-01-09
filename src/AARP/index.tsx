import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useState,
} from "react";
import {
  AarpActivityWithStatus,
  AarpUser,
  earnActivityRewards,
  updateAarpTab,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { LOGIN_URL } from "./modules/tools";

type AARPData =
  | {
      status: "loggedIn" | "mustConfirmPassword";
      user: AarpUser;
      activities: AarpActivityWithStatus[];
    }
  | { status: "notLoggedIn" };

const MAX_DAILY_REWARDS = 5000;
const ACTIVITIES_CHUNK_SIZE = 5;
const MAX_ACTIVITIES = 4000; // Should never really get beyond this, but just a cut off in that case

const AARPDataContext = createContext<AARPData | "loading">("loading");

function Activity({ activityIdx }: { activityIdx: number }) {
  const aarpData = useContext(AARPDataContext);

  if (aarpData === "loading" || aarpData.status !== "loggedIn")
    throw new Error(
      "To create <Activity/>, AARP must have finished loading and must be logged into"
    );

  const activity = aarpData.activities[activityIdx];
  if (!activity) throw RangeError("<Activity/> activityIdx out of bounds");

  return (
    <div>
      <div>
        <h4>{activity.name}</h4>
        {activity.isCompleted ? (
          <p>Completed</p>
        ) : (
          <p>{activity.activityType.basePointValue}</p>
        )}
      </div>
      <p>{activity.description}</p>
      {activity.isCompleted || (
        <a
          onClick={() =>
            earnActivityRewards({
              activity: {
                identifier: activity.identifier,
                url: activity.url,
                type: activity.activityType.identifier,
              },
              openActivityUrl: true,
              user: aarpData.user,
            })
          }
        >
          Get rewards
        </a>
      )}
    </div>
  );
}

function AARP() {
  const aarpData = useContext(AARPDataContext);
  const [nActivitiesDisplayed, setNActivitiesDisplayed] = useState<number>(
    ACTIVITIES_CHUNK_SIZE
  );

  if (aarpData === "loading") return <LoadingAnimation />;
  if (aarpData.status !== "loggedIn")
    return (
      <div>
        <h2>
          {aarpData.status === "mustConfirmPassword"
            ? `You are logged in as ${aarpData.user.username}, but you need to confirm your password.`
            : "You are not logged into AARP."}
        </h2>
        <a onClick={() => updateAarpTab({ url: LOGIN_URL })}>Log in</a>
      </div>
    );

  return (
    <div>
      <div>
        <h2>Hello {aarpData.user.username}!</h2>
        <h3>Rewards balance: {aarpData.user.rewardsBalance ?? "unknown"}</h3>
        <h3>Daily points left: {aarpData.user.dailyPointsLeft ?? "unknown"}</h3>
      </div>
      <div>
        {aarpData.activities.length > 0 ? (
          <>
            <div>
              {aarpData.activities
                .slice(0, nActivitiesDisplayed)
                .map((_, idx) => (
                  <Activity key={idx} activityIdx={idx} />
                ))}
            </div>
          </>
        ) : (
          <p>No activities found.</p>
        )}
      </div>
    </div>
  );
}

function AARPDataProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AarpUser | null>(null);
  const [activities, setActivities] = useState<AarpActivityWithStatus[]>([]);

  const aarpData: AARPData | "loading" = isLoading
    ? "loading"
    : user
    ? {
        status: user.mustConfirmPassword ? "mustConfirmPassword" : "loggedIn",
        activities: activities,
        user: user,
      }
    : { status: "notLoggedIn" };

  return (
    <AARPDataContext.Provider value={aarpData}>
      {children}
    </AARPDataContext.Provider>
  );
}

export default {
  name: "AARP",
  element: (
    <AARPDataProvider>
      <AARP />
    </AARPDataProvider>
  ),
};
