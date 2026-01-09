import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AarpActivity,
  AarpUser,
  earnActivityRewards,
  getActivities,
  getActivityStatuses,
  getUser,
  updateAarpTab,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { isAarpTab, LOGIN_URL } from "./modules/tools";
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

  // Handle edge cases (loading or not logged in) -------------------------------------------------

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

  // Filtering, displaying, and fetching statuses of activities -----------------------------------

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

  // Hook for applying filters
  useEffect(() => {
    if (aarpData.activities.length > 0 && nActivitiesShown > 0) {
      setActivitiesAreLoading(true);

      // Async because I want the activitiesAreLoading to be applied
      new Promise<ReturnType<typeof applyActivitiesFilter>>((resolve) =>
        resolve(applyActivitiesFilter(aarpData.activities, activitiesFilter))
      ).then((newFilteredActivities) => {
        setFilteredActivities(newFilteredActivities);
        setActivitiesAreLoading(false);
      });
    }
  }, [activitiesFilter, aarpData.activities, aarpData.user]);

  useEffect(() => {
    if (filteredActivities.length > 0 && nActivitiesShown > 0) {
      const activitiesToCheck = filteredActivities
        .slice(0, nActivitiesShown) // Don't worry about those not shown
        .filter((activityIdx) => activityStatuses[activityIdx] !== "complete")
        .map((activityIdx) => ({
          idx: activityIdx,
          id: aarpData.activities[activityIdx].identifier,
        }));

      if (activitiesToCheck.length > 0) {
        getActivityStatuses({
          activityIds: activitiesToCheck.map(({ id }) => id),
          userFedId: aarpData.user.fedId,
          accessToken: aarpData.user.accessToken,
        })
          .then(({ activityFinishedStatuses, userDailyPointsLeft }) => {
            // TODO: activity status response also gives the daily rewards left, which should be used to update it whenever we get there
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

  // The UI and stuff -----------------------------------------------------------------------------

  return (
    <div>
      <div>
        <h2>Hello {aarpData.user.username}!</h2>
        <h3>Rewards balance: {aarpData.user.rewardsBalance ?? "unknown"}</h3>
        <h3>Daily points left: {aarpData.user.dailyPointsLeft ?? "unknown"}</h3>
      </div>
      <div>
        {activitiesAreLoading ? (
          <LoadingAnimation />
        ) : aarpData.activities.length > 0 ? (
          <>
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

  const fullyLoggedIn = !isLoading && user && !user.mustConfirmPassword;

  useEffect(() => {
    // If a tab goes to an AARP url, we need to check to see if the user has changed and if the
    const updateUserListener = (
      _: any,
      update: chrome.tabs.UpdateProperties,
      tab: chrome.tabs.Tab
    ) => {
      if (
        tab.active &&
        update.url &&
        tab.status === "complete" &&
        isAarpTab(tab.url)
      ) {
        if (!isLoading) setIsLoading(true);
        getUser()
          .then((newUser) => {
            if (!simpleDeepCompare(user, newUser)) setUser(newUser);
          })
          .finally(() => setIsLoading(false));
      }
    };

    chrome.tabs.onUpdated.addListener(updateUserListener);

    // Trigger listener to get initial user and activiites
    updateAarpTab({ active: true });

    return () => chrome.tabs.onUpdated.removeListener(updateUserListener);
  }, []);

  useEffect(() => {
    if (fullyLoggedIn) {
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
