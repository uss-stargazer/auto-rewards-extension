import React, { useEffect, useState } from "react";
import {
  AarpActivity,
  AarpUser,
  earnActivityRewards,
  getActivities,
  getActivityStatus,
  getUser,
  updateAarpTab,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { LOGIN_URL } from "./modules/tools";

const MAX_DAILY_REWARDS = 5000;
const ACTIVITIES_CHUNK_SIZE = 5;
const MAX_ACTIVITIES = 5 * ACTIVITIES_CHUNK_SIZE;

function Activity({ activity }: { activity: AarpActivity }) {
  const [isComplete, setIsComplete] = useState<boolean>();

  useEffect(() => {
    if (!isComplete) {
      getActivityStatus(activity.identifier).then((status) =>
        setIsComplete(status.completed)
      );
    }
  }, [isComplete]);

  return (
    <div>
      <div>
        <h4>{activity.name}</h4>
        {isComplete ? (
          <p>Completed</p>
        ) : (
          <p>{activity.activityType.basePointValue}</p>
        )}
      </div>
      <p>{activity.description}</p>
      {isComplete || (
        <a
          onClick={() =>
            earnActivityRewards({
              activity: activity,
              openActivityUrl: true,
            }).then(() => setIsComplete(true))
          }
        >
          Get rewards
        </a>
      )}
    </div>
  );
}

function AARP() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AarpUser | null>(null);
  const [activities, setActivities] = useState<AarpActivity[]>([]);
  const [nActivitiesDisplayed, setNActivitiesDisplayed] = useState<number>(
    ACTIVITIES_CHUNK_SIZE
  );

  const updateUser = () => getUser().then((user) => setUser(user));
  useEffect(() => {
    updateUser().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      getActivities(MAX_ACTIVITIES)
        .then((aarpActivities) => setActivities(aarpActivities))
        .catch(() => setActivities([]));
    }
  }, [user]);

  const NotLoggedInPrompt = () => (
    <div>
      <h2>You are not logged into AARP.</h2>
      <div>
        <a onClick={() => updateAarpTab({ url: LOGIN_URL })}>Log in</a>
        <a onClick={updateUser}>Refresh</a>
      </div>
    </div>
  );

  if (!user) return isLoading ? <LoadingAnimation /> : <NotLoggedInPrompt />;

  return (
    <div>
      <div>
        <h2>Hello {user.username}!</h2>
        <h3>Rewards balance: {user.rewardsBalance ?? "unknown"}</h3>
        <h3>Daily points left: {user.dailyPointsLeft ?? "unknown"}</h3>
      </div>
      <div>
        {activities.length > 0 ? (
          <>
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

export default {
  name: "AARP",
  element: <AARP />,
};
