import React, {
  act,
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AarpActivity,
  AarpActivityWithStatus,
  AarpUser,
  earnActivityRewards,
  getActivities,
  getUser,
  updateAarpTab,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { LOGIN_URL, isAarpTab } from "./modules/tools";
import { simpleDeepCompare } from "../modules/utils";

type AARPData =
  | {
      status: "loggedIn" | "mustConfirmPassword";
      user: AarpUser;
      activities: AarpActivity[];
    }
  | { status: "notLoggedIn" };

const MAX_DAILY_REWARDS = 5000;
const ACTIVITIES_CHUNK_SIZE = 5;
const MAX_ACTIVITIES = 4000; // Should never really get beyond this, but just a cut off in that case

const AARPDataContext = createContext<AARPData | "loading">("loading");

function Activity({
  activityIdx,
  isCompleted,
}: {
  activityIdx: number;
  isCompleted: boolean;
}) {
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
        {isCompleted ? (
          <p>Completed</p>
        ) : (
          <p>{activity.activityType.basePointValue}</p>
        )}
      </div>
      <p>{activity.description}</p>
      {isCompleted || (
        <a
          onClick={() =>
            earnActivityRewards({
              activity: { ...activity, type: activity.activityType.identifier },
              openActivityUrl: true,
              user: { ...aarpData.user },
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

  const [activitiesAreLoading, setActivitiesAreLoading] = [false, false];
  useState<boolean>(true);
  const [completedActivities, setCompletedActivities] = useState<number[]>([]);
  const [shownActivities, setShownActivities] = useState<number[]>([]);

  // some useEffect here to populate shown activities and get status for all of em before populating

  // some function to modify shown activities from search of something

  const earnMaxDailyRewards = async () => {
    if (aarpData.activities) {
      let dailyRewardsLeft =
        aarpData.user.dailyRewardsAvailable ?? MAX_DAILY_REWARDS;
      let activityIdx = 0;
      while (aarpData.activities[activityIdx] && dailyRewardsLeft > 0) {
        const activity = aarpData.activities[activityIdx];
        const rewards = await earnActivityRewards({
          activity: { ...activity, type: activity.activityType.identifier },
          openActivityUrl: false,
          user: { ...aarpData.user },
        });
        if (rewards && rewards.success)
          dailyRewardsLeft = rewards.userDailyPointsLeft;
        activityIdx++;
      }
    }
  };

  return (
    <div>
      <div>
        <h2>Hello {aarpData.user.username}!</h2>
        <h3>Rewards balance: {aarpData.user.rewardsBalance ?? "unknown"}</h3>
      </div>
      <div>
        {activitiesAreLoading ? (
          <LoadingAnimation />
        ) : aarpData.activities.length > 0 ? (
          <>
            <a onClick={earnMaxDailyRewards}>Get max rewards</a>
            <div>
              {aarpData.activities.slice(0, 10).map((acitivity, idx) => (
                <Activity key={idx} activityIdx={idx} isCompleted={false} />
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
  const [activities, setActivities] = useState<AarpActivity[]>([]);

  // Listen for potential user changes from service worker (via a port)
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

  console.log("[index.tsx] AARP data reloaded:", {
    isLoading,
    user,
    activities,
  });

  const fullyLoggedIn = !isLoading && user && !user.userMustConfirmPassword;

  useEffect(() => {
    getUser()
      .then((newUser) => setUser(newUser))
      .finally(() => setIsLoading(false));

    const sidepanelPort = chrome.runtime.connect({ name: "sidepanel-port" });
    setPort(sidepanelPort);

    return sidepanelPort.disconnect;
  }, []);

  // Update port message listener has seperate effect because it relies on user state
  useEffect(() => {
    if (port) {
      const userUpdateListener = (newUser: AarpUser | null) => {
        console.log("[index.tsx] got user update", newUser);
        if (!simpleDeepCompare(user, newUser)) {
          console.log("[index.tsx] updated user has changed so setting user");
          setUser(newUser);
        } else {
          console.log(
            "[index.tsx] updated user has not changed. user:",
            user,
            " |  updated user:",
            newUser
          );
        }
      };
      port.onMessage.addListener(userUpdateListener);
      return () => port.onMessage.removeListener(userUpdateListener);
    }
  }, [port, user]);

  useEffect(() => {
    if (fullyLoggedIn) {
      console.log("[index.tsx] set activities useEffect has been called");
      getActivities({
        maxNActivities: MAX_ACTIVITIES,
        accessToken: user.accessToken,
      })
        .then((newActivities) => {
          setActivities(newActivities);
        })
        .catch(() => setActivities([]));
    } else {
      setActivities([]);
    }
  }, [user]);

  const aarpData: AARPData | "loading" = isLoading
    ? "loading"
    : user
    ? {
        status: user.userMustConfirmPassword
          ? "mustConfirmPassword"
          : "loggedIn",
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
