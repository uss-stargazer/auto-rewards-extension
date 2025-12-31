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

  const earnMaxDailyRewards = async () => {
    if (aarpData.activities) {
      let dailyRewardsLeft =
        aarpData.user.dailyRewardsAvailable ?? MAX_DAILY_REWARDS;
      let activityIdx = 0;
      while (aarpData.activities[activityIdx] && dailyRewardsLeft > 0) {
        const rewards = await earnActivityRewards({
          activity: aarpData.activities[activityIdx],
          openActivityUrl: false,
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
        <h2>Hello {user.username}!</h2>
        <h3>Rewards balance: {user.rewardsBalance ?? "unknown"}</h3>
      </div>
      <div>
        {activities.length > 0 ? (
          <>
            <a onClick={earnMaxDailyRewards}>Get max rewards</a>
            <div>
              {activities
                .slice(0, nActivitiesDisplayed)
                .map((activity, idx) => (
                  <Activity key={idx} activity={activity} />
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

  const fullyLoggedIn = !isLoading && user && !user.userMustConfirmPassword;

  useEffect(() => {
    // If a tab goes to an AARP url, we need to check to see if the user has changed and if the
    const tabUpdateListener = (
      _: any,
      update: chrome.tabs.UpdateProperties,
      tab: chrome.tabs.Tab
    ) => {
      console.log("[index.tsx] update user listener cdalled");
      if (
        tab.active &&
        update.url &&
        tab.status === "complete" &&
        isAarpTab(tab.url)
      ) {
        if (!isLoading) setIsLoading(true);
        getUser()
          .then((newUser) => {
            console.log("[index.tsx] got user from update user listner");
            if (!simpleDeepCompare(user, newUser)) setUser(newUser);
          })
          .finally(() => setIsLoading(false));
      }
    };

    console.log("[index.tsx] attached updated listener");
    chrome.tabs.onUpdated.addListener(updateUserListener);

    console.log(
      "[index.tsx] inital update of aarp tab to trigger getting user"
    );
    // Trigger listener to get initial user and activiites
    updateAarpTab({ active: true });

    return () => chrome.tabs.onUpdated.removeListener(updateUserListener);
  }, []);

  useEffect(() => {
    if (fullyLoggedIn) {
      console.log("[index.tsx] set activities useEffect has been called");
      getActivities({
        maxNActivities: MAX_ACTIVITIES,
        accessToken: user.accessToken,
      })
        .then((aarpActivities) => {
          setActivities(aarpActivities);
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
