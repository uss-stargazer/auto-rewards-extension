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

export function AARP() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AarpUser | null>(null);
  const [activities, setActivities] = useState<AarpActivity[]>([]);
  const [nActivitiesDisplayed, setNActivitiesDisplayed] = useState<number>(
    ACTIVITIES_CHUNK_SIZE
  );

  const updateUser = () => getUser().then((user) => setUser(user));
  useEffect(() => {
    console.log("updating user");
    updateUser().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      console.log("getting activities");
      getActivities(MAX_ACTIVITIES)
        .then((aarpActivities) => {
          console.log("setting activities");
          setActivities(aarpActivities);
        })
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

  const earnMaxDailyRewards = () => {
    if (user && activities) {
      let dailyRewardsLeft = MAX_DAILY_REWARDS;
      let activityN = 0;
      while (activities[activityN] && dailyRewardsLeft > 0) {}
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

// function AARP() {
//   return (
//     <>
//       <button
//         onClick={() =>
//           updateAarpTab({
//             url: "https://www.aarp.org/afslfja/afdsa/fds/",
//             active: true,
//           }).then((tabid) =>
//             chrome.tabs
//               .get(tabid)
//               .then((tab) => console.log("index.tsx: got updated tab:", tab))
//           )
//         }
//       >
//         update aarp tab to https://www.aarp.org/afslfja/afdsa/fds/
//       </button>

//       <button
//         onClick={() =>
//           getUser().then((user) => console.log("index.tsx: got user:", user))
//         }
//       >
//         G3t user
//       </button>

//       <button
//         onClick={() =>
//           getActivities(20).then((activities) =>
//             console.log("index.tsx: get activities:", activities)
//           )
//         }
//       >
//         G3t activtiies (20)
//       </button>

//       <button
//         onClick={() =>
//           getActivityStatus("fjdkla;f").then((status) =>
//             console.log("index.ts: get activity status:", status)
//           )
//         }
//       >
//         get activity status with bad id
//       </button>

//       <button
//         onClick={() =>
//           earnActivityRewards({
//             activity: {
//               identifier: "jfdkaljfkld;",
//               startDate: "2019-07-11T01:00:00.000Z",
//               endDate: "2031-01-01T04:59:00.000Z",
//               activityType: {
//                 identifier: "monthlyFitness",
//                 basePointValue: 1000,
//                 name: "Fitness Tracker",
//                 visibleOnSite: true,
//                 active: true,
//               },

//               name: "Bike 250 miles in a month",
//               category: "health",
//               url: "https://www.aarp.org/rewards/earn/fitness/bike/",
//               imageUrl:
//                 "https://cdn.aarp.net/content/dam/aarp/rewards/earn-activities/2019/sports-cooler.svg",
//               description:
//                 "Crush this goal by the end of the month. Let's do it!",
//               primaryTopic: "Fitness",
//               active: true,
//               deleted: false,
//               membersOnly: false,
//             },
//             openActivityUrl: true,
//           }).then((rewards) => console.log("index.tsx: earn rewards:", rewards))
//         }
//       >
//         Earn rewards with bad activity
//       </button>
//     </>
//   );
// }

export default {
  name: "AARP",
  element: <AARP />,
};
