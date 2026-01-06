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
  getActivityStatuses,
  getUser,
  updateAarpTab,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { LOGIN_URL, isAarpTab } from "./modules/tools";
import { simpleDeepCompare } from "../modules/utils";
import {
  ActivitiesFilter,
  applyActivitiesFilter,
} from "./modules/activitiesFilter";

type AARPData =
  | {
      status: "loggedIn" | "mustConfirmPassword";
      user: AarpUser;
      activities: AarpActivity[];
    }
  | { status: "notLoggedIn" };
type ActivityStatus = "complete" | "incomplete" | "unknown";

const MAX_DAILY_REWARDS = 5000;
const ACTIVITIES_CHUNK_SIZE = 5;
const MAX_ACTIVITIES = 4000; // Should never really get beyond this, but a cut off just in case

const AARPDataContext = createContext<AARPData | "loading">("loading");

function Activity({
  activityIdx,
  status,
}: {
  activityIdx: number;
  status: ActivityStatus;
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
        {status === "complete" ? (
          <p>Completed</p>
        ) : status === "incomplete" ? (
          <p>{activity.activityType.basePointValue}</p>
        ) : (
          <p>Error fetching status</p>
        )}
      </div>
      <p>{activity.description}</p>
      {status === "incomplete" && (
        <a
          onClick={() =>
            earnActivityRewards({
              activity: { ...activity, type: activity.activityType.identifier },
              user: { ...aarpData.user },
            }).then((rewardsResponse) => {
              // TODO: activity status response also gives the daily rewards left, which should be used to update it whenever we get there
              updateAarpTab({ url: activity.url });
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
        <a onClick={() => updateAarpTab({ url: LOGIN_URL, active: true })}>
          Log in
        </a>
      </div>
    );

  const [activitiesFilter, setActivitiesFilter] = //
    useState<ActivitiesFilter>({});
  const [activitiesAreLoading, setActivitiesAreLoading] =
    useState<boolean>(true);
  const [filteredActivities, setFilteredActivities] = useState<
    { activityIdx: number; status: ActivityStatus }[]
  >([]);
  const [nActivitiesShown, setNActivitiesShown] = useState<number>(
    ACTIVITIES_CHUNK_SIZE
  );

  console.log(
    "[index.tsx, AARP display obj] AARP activities settings reloaded:",
    {
      activitiesFilter,
      activitiesAreLoading,
      filteredActivities,
      nActivitiesShown,
    }
  );

  useEffect(() => {
    if (aarpData.activities.length > 0 && nActivitiesShown > 0) {
      console.log(
        "[index.tsx, getShownActivities] applying filter and fetching statuses"
      );
      if (!activitiesAreLoading) setActivitiesAreLoading(true);

      // Async because I want the activitiesAreLoading to be applied
      new Promise<ReturnType<typeof applyActivitiesFilter>>((resolve) =>
        resolve(applyActivitiesFilter(aarpData.activities, activitiesFilter))
      ).then((newFilteredActivities) => {
        console.log(
          "[index.tsx, getShownActivities] filter has been applied:",
          newFilteredActivities
        );
        setFilteredActivities(
          newFilteredActivities.map((activityIdx) => {
            const status = filteredActivities.find(
              ({ activityIdx: prevActivityIdx }) =>
                prevActivityIdx === activityIdx
            )?.status;
            return {
              activityIdx,
              // If activities status has already been determined, reuse it
              status: status === "complete" ? status : "unknown",
            };
          })
        );
        if (activitiesAreLoading) setActivitiesAreLoading(false);
      });
    }
  }, [activitiesFilter, aarpData.activities, aarpData.user]);

  useEffect(() => {
    if (!activitiesAreLoading) setActivitiesAreLoading(true);

    const activitiesToCheck = filteredActivities
      .filter(({ status }) => status !== "complete")
      .map(({ activityIdx }) => ({
        idx: activityIdx,
        id: aarpData.activities[activityIdx].identifier,
      }));

    getActivityStatuses({
      activityIds: activitiesToCheck.map(({ id }) => id),
      userFedId: aarpData.user.fedId,
      accessToken: aarpData.user.accessToken,
    })
      .then(({ activityFinishedStatuses, userDailyPointsLeft }) => {
        // TODO: activity status response also gives the daily rewards left, which should be used to update it whenever we get there
        console.log(
          "[index.tsx, getShownActivities] activity statuses have been fetched:",
          activityFinishedStatuses,
          userDailyPointsLeft
        );
        setFilteredActivities(
          filteredActivities.map((filteredActivity) => {
            const checkIdx = activitiesToCheck.findIndex(
              ({ idx: testIdx }) => testIdx === filteredActivity.activityIdx
            );
            if (checkIdx >= 0) {
              const isComplete = activityFinishedStatuses[checkIdx];
              return {
                activityIdx: filteredActivity.activityIdx,
                status:
                  isComplete === undefined
                    ? "unknown"
                    : isComplete
                    ? "complete"
                    : "incomplete",
              };
            }
            return filteredActivity;
          })
        );
      })
      .catch((reason) => {
        console.error(
          "Failed to fetch statuses for activities:",
          reason,
          "(activities:",
          filteredActivities,
          ")"
        );
        setFilteredActivities([]);
        setActivitiesAreLoading(false);
      })
      .finally(() => setActivitiesAreLoading(false));
  }, [filteredActivities, nActivitiesShown]);

  const earnMaxDailyRewards = async () => {
    if (aarpData.activities) {
      let dailyRewardsLeft =
        aarpData.user.dailyRewardsAvailable ?? MAX_DAILY_REWARDS;
      let activityIdx = 0;
      while (aarpData.activities[activityIdx] && dailyRewardsLeft > 0) {
        const activity = aarpData.activities[activityIdx];
        const rewards = await earnActivityRewards({
          activity: { ...activity, type: activity.activityType.identifier },
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
            <a onClick={earnMaxDailyRewards}>Earn max daily rewards</a>
            <div>
              {nActivitiesShown > 0 ? (
                filteredActivities.map(({ activityIdx, status }) => (
                  <Activity
                    key={activityIdx}
                    activityIdx={activityIdx}
                    status={status}
                  />
                ))
              ) : (
                <p>Showing 0 activities</p>
              )}
            </div>
            <div>
              <button
                onClick={() =>
                  setNActivitiesShown(nActivitiesShown - ACTIVITIES_CHUNK_SIZE)
                }
              >
                Show less
              </button>
              <button
                onClick={() =>
                  setNActivitiesShown(nActivitiesShown + ACTIVITIES_CHUNK_SIZE)
                }
              >
                Show more
              </button>
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
