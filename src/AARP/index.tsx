import React, { useEffect, useState } from "react";
import {
  AarpActivity,
  AarpUser,
  earnActivityRewards,
  getActivities,
  getUser,
  updateAarpTab,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { LOGIN_URL } from "./modules/tools";

const MAX_ACTIVITIES = 25;

function Activity({ activity }: { activity: AarpActivity }) {
  const [isComplete, setIsComplete] = useState<boolean>(false);

  return (
    <div>
      <p>Activity ({activity.identifier})</p>
      {isComplete ? (
        <p>Completed</p>
      ) : (
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
          activities.map((activity, idx) => (
            <Activity key={idx} activity={activity} />
          ))
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
