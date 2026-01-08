import React, { useEffect, useState } from "react";
import {
  AarpUser,
  getUser,
} from "./modules/definitions";
import LoadingAnimation from "../components/LoadingAnimation";
import { LOGIN_URL } from "./modules/tools";

function AARP() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AarpUser | null>(null);

  const updateUser = () => getUser().then((user) => setUser(user));
  useEffect(() => {
    updateUser().finally(() => setIsLoading(false));
  }, []);

  const NotLoggedInPrompt = () => (
    <div>
      <h2>You are not logged into AARP.</h2>
      <div>
        <a href={LOGIN_URL}>Log in</a>
        <a onClick={updateUser}>Refresh</a>
      </div>
    </div>
  );

  if (!user) return isLoading ? <LoadingAnimation /> : <NotLoggedInPrompt />;

  return (
    <div>
      <h2>Hello {user.username}!</h2>
    </div>
  );
}

export default {
  name: "AARP",
  element: <AARP />,
};
