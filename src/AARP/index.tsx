import React, { useEffect, useState } from "react";
import { getUser } from "./modules/mechanics";
import { AarpUser } from "./modules/definitions";

export function AARP() {
  const [user, setUser] = useState<AarpUser | null>(null);

  useEffect(() => {
    (async () => {
      setUser(await getUser());
    })();
  });

  return (
    <div>
      <p>AARP etnry</p>;
      {user ? (
        <p>Hiya {user.username}. You are logged into AARP!</p>
      ) : (
        <p>You ain't logged in</p>
      )}
    </div>
  );
}
