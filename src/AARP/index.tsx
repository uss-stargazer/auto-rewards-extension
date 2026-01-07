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

  const [activitiesAreLoading, setActivitiesAreLoading] =
    useState<boolean>(true);
  const [activitiesFilter, setActivitiesFilter] = useState<ActivitiesFilter>(
    {}
  );
  const [filteredActivities, setFilteredActivities] = useState<number[]>([]);
  const [activityStatuses, setActivityStatuses] = useState<{
    [key: number]: ActivityStatus;
  }>({});
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
      console.log("[index.tsx, applyActivitiesFilter] applying filter");
      setActivitiesAreLoading(true);

      // Async because I want the activitiesAreLoading to be applied
      new Promise<ReturnType<typeof applyActivitiesFilter>>((resolve) =>
        resolve(applyActivitiesFilter(aarpData.activities, activitiesFilter))
      ).then((newFilteredActivities) => {
        console.log(
          "[index.tsx, applyActivitiesFilter] filter has been applied:",
          newFilteredActivities
        );
        setFilteredActivities(newFilteredActivities);
        setActivitiesAreLoading(false);
      });
    }
  }, [activitiesFilter, aarpData.activities, aarpData.user]);

  useEffect(() => {
    if (filteredActivities.length > 0 && nActivitiesShown > 0) {
      console.log("[index.tsx, fetchShown activity statuses] start");

      const activitiesToCheck = filteredActivities
        .slice(0, nActivitiesShown) // Don't worry about those not shown
        .filter((activityIdx) => activityStatuses[activityIdx] !== "complete")
        .map((activityIdx) => ({
          idx: activityIdx,
          id: aarpData.activities[activityIdx].identifier,
        }));

      console.log(
        "[index.tsx, fetchShown activity statuses] activities to check:",
        activitiesToCheck
      );

      if (activitiesToCheck.length > 0) {
        getActivityStatuses({
          activityIds: activitiesToCheck.map(({ id }) => id),
          userFedId: aarpData.user.fedId,
          accessToken: aarpData.user.accessToken,
        })
          .then(({ activityFinishedStatuses, userDailyPointsLeft }) => {
            // TODO: activity status response also gives the daily rewards left, which should be used to update it whenever we get there
            console.log(
              "[index.tsx, fetchShown activity statuses] activity statuses have been fetched:",
              activityFinishedStatuses,
              "; daily points:",
              userDailyPointsLeft
            );
            const newActivityStatuses = activityFinishedStatuses.reduce(
              (activityStatuses, isComplete, checkIdx) => {
                activityStatuses[activitiesToCheck[checkIdx].idx] =
                  isComplete === undefined
                    ? "unknown"
                    : isComplete
                    ? "complete"
                    : "incomplete";
                return activityStatuses;
              },
              { ...activityStatuses }
            );
            console.log(
              "[index.tsx, fetchShown activity statuses] new activity statuses:",
              newActivityStatuses
            );
            setActivityStatuses(newActivityStatuses);
          })
          .catch((reason) => {
            console.error(
              "Failed to fetch statuses for activities:",
              reason,
              "(activities:",
              activitiesToCheck,
              ")"
            );
            setActivityStatuses([]);
          });
      }
    }
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
                filteredActivities
                  .slice(0, nActivitiesShown)
                  .map((activityIdx) => (
                    <Activity
                      key={activityIdx}
                      activityIdx={activityIdx}
                      status={activityStatuses[activityIdx] ?? "unknown"}
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
