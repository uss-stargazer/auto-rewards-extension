import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AarpActivity,
  AarpBalance,
  AarpUser,
  earnActivityRewards,
  getActivities,
  getActivityStatuses,
  getUser,
  updateAarpTab,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { LOGIN_URL } from "./modules/tools";
import { simpleDeepCompare } from "../modules/utils";
import {
  ActivitiesFilter,
  applyActivitiesFilter,
} from "./modules/activitiesFilter";
import { MdCheckCircle, MdRefresh } from "react-icons/md";
import { FaCircleMinus, FaCirclePlus } from "react-icons/fa6";

type AARPData =
  | {
      status: "loggedIn" | "mustConfirmPassword";
      user: AarpUser;
      balance: AarpBalance;
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
  onRewardsEarned,
}: {
  activityIdx: number;
  status: ActivityStatus;
  onRewardsEarned: () => void;
}) {
  const aarpData = useContext(AARPDataContext);

  if (aarpData === "loading" || aarpData.status !== "loggedIn")
    throw new Error(
      "To create <Activity/>, AARP must have finished loading and must be logged into"
    );

  const activity = aarpData.activities[activityIdx];
  if (!activity) throw RangeError("<Activity/> activityIdx out of bounds");

  return (
    <div className="block list">
      <div className="bar">
        <h4
          className="clickable"
          onClick={() => updateAarpTab({ active: true, url: activity.url })}
        >
          {activity.name}
        </h4>
        {status === "complete" ? (
          <MdCheckCircle className="large-icon primary-color" />
        ) : (
          <h4 className="primary-color one-line">
            {status === "incomplete"
              ? activity.activityType.basePointValue
              : "Status unknown"}
          </h4>
        )}
      </div>

      <p>{activity.description}</p>

      {status === "incomplete" && (
        <div className="bar">
          <div />
          <a
            className="btn one-line"
            onClick={() =>
              earnActivityRewards({
                activity: {
                  ...activity,
                  type: activity.activityType.identifier,
                },
                user: { ...aarpData.user },
              }).then((rewardsResponse) => {
                updateAarpTab({ url: activity.url }).then(onRewardsEarned); // Wait for update to load before running onRewardsEarneds
              })
            }
          >
            Earn rewards
          </a>
        </div>
      )}
    </div>
  );
}

function AARP() {
  const aarpData = useContext(AARPDataContext);

  if (aarpData === "loading" || aarpData.status !== "loggedIn")
    throw new Error("AARP can be rendered when user is not logged in");

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

  // Hook for updating status of shown activities defined as a function so buttons can refresh activity statuses
  const updateActivityStatuses = async () => {
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
        .then((activityFinishedStatuses) => {
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
  };

  // The meat of this hook is really updateActivityStatuses()
  useEffect(() => {
    if (filteredActivities.length > 0 && nActivitiesShown > 0) {
      updateActivityStatuses();
    }
  }, [filteredActivities, nActivitiesShown]);

  // The UI and stuff -----------------------------------------------------------------------------

  return (
    <>
      <div>
        <h2>
          Hi <span className="primary-color">{aarpData.user.username}</span>
        </h2>
        <div className="bar">
          <h4>Rewards balance:</h4>
          <h3 className="primary-color">
            {aarpData.balance.rewardsBalance ?? "unknown"}
          </h3>
        </div>
        <div className="bar">
          <h4>Available today:</h4>
          <h3 className="primary-color">
            {aarpData.balance.dailyPointsLeft ?? "unknown"}
          </h3>
        </div>
      </div>

      <hr />

      {activitiesAreLoading ? (
        <LoadingAnimation />
      ) : aarpData.activities.length > 0 ? (
        <div className="list medium-gap">
          <div className="center-items">
            <a className="button-icon" onClick={updateActivityStatuses}>
              <MdRefresh className="medium-icon" />
            </a>
          </div>
          <div className="list">
            {nActivitiesShown > 0 ? (
              filteredActivities
                .slice(0, nActivitiesShown)
                .map((activityIdx) => (
                  <Activity
                    key={activityIdx}
                    activityIdx={activityIdx}
                    status={activityStatuses[activityIdx] ?? "unknown"}
                    onRewardsEarned={updateActivityStatuses}
                  />
                ))
            ) : (
              <p>Showing 0 activities</p>
            )}
          </div>
          <div className="center-items">
            <a
              className="button-icon"
              onClick={() =>
                setNActivitiesShown(nActivitiesShown - ACTIVITIES_CHUNK_SIZE)
              }
            >
              <FaCircleMinus className="medium-icon" />
            </a>
            <a
              className="button-icon"
              onClick={() =>
                setNActivitiesShown(nActivitiesShown + ACTIVITIES_CHUNK_SIZE)
              }
            >
              <FaCirclePlus className="medium-icon" />
            </a>
          </div>
        </div>
      ) : (
        <p>No activities found.</p>
      )}
    </>
  );
}

function AARPUserCheck({ children }: PropsWithChildren) {
  const aarpData = useContext(AARPDataContext);

  // Handle edge cases (loading or not logged in) -------------------------------------------------

  if (aarpData === "loading") return <LoadingAnimation />;
  if (aarpData.status !== "loggedIn")
    return (
      <>
        <div className="bar">
          <h3>
            {aarpData.status === "mustConfirmPassword" ? (
              <>
                You are logged in as
                <span className="primary-color"> {aarpData.user.username}</span>
                , but you need to confirm your password.
              </>
            ) : (
              "You are not logged into AARP."
            )}
          </h3>
          <a
            className="btn one-line"
            onClick={() => updateAarpTab({ url: LOGIN_URL, active: true })}
          >
            Log in
          </a>
        </div>
      </>
    );

  return children;
}

function AARPDataProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AarpUser | null>(null);
  const [balance, setBalance] = useState<AarpBalance>({});
  const [activities, setActivities] = useState<AarpActivity[]>([]);

  // Listen for potential user changes from service worker (via a port)
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

  const fullyLoggedIn = !isLoading && user && !user.mustConfirmPassword;

  useEffect(() => {
    getUser()
      .then(({ user: newUser, balance: newBalance }) => {
        setUser(newUser);
        setBalance(newBalance);
      })
      .finally(() => setIsLoading(false));

    const sidepanelPort = chrome.runtime.connect({ name: "sidepanel-port" });
    setPort(sidepanelPort);

    return sidepanelPort.disconnect;
  }, []);

  // Update port message listener has seperate effect because it relies on user state
  useEffect(() => {
    if (port) {
      const userUpdateListener = ({
        user: newUser,
        balance: newBalance,
      }: {
        user: AarpUser | null;
        balance: AarpBalance;
      }) => {
        if (!simpleDeepCompare(user, newUser)) setUser(newUser);
        if (!simpleDeepCompare(balance, newBalance)) setBalance(newBalance);
      };
      port.onMessage.addListener(userUpdateListener);
      return () => port.onMessage.removeListener(userUpdateListener);
    }
  }, [port, user]);

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
        user,
        balance,
        activities,
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
      <AARPUserCheck>
        <AARP />
      </AARPUserCheck>
    </AARPDataProvider>
  ),
};
