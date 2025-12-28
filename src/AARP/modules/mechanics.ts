import { MessageRequest, MessageResponse } from "../contentScript";
import { sendMessageAync, WithFixedProperties } from "../../modules/utils";
import {
  AarpActivity,
  AarpUser,
  NotLoggedInError,
  RewardsResponseSchema,
} from "./definitions";

export const ORIGIN = "https://www.aarp.org";
export const LOGIN_URL = "https://secure.aarp.org/applications/user/login";
export const REWARDS_URL = `${ORIGIN}/rewards/earn`;

export function isAarpTab(tabUrl: string | undefined): boolean {
  return (tabUrl && /aarp.org$/.test(new URL(tabUrl).hostname)) || false;
}

export async function getUser(
  aarpTab: chrome.tabs.Tab
): Promise<AarpUser | null> {
  if (!isAarpTab(aarpTab.url))
    throw new Error("Tab must be in the AARP domain to get user");

  const username = await chrome.cookies.get({
    name: "game",
    url: "https://secure.aarp.org",
  });
  const userFedId = await chrome.cookies.get({
    name: "fedid",
    url: "https://secure.aarp.org",
  });
  const accessToken = await sendMessageAync(aarpTab.id!, {
    action: "getLocalStorage",
    key: "access_token",
  } satisfies MessageRequest);
  return (
    username &&
    userFedId &&
    accessToken && {
      username: username,
      fedId: userFedId,
      accessToken: accessToken,
    }
  );
}

export async function* getActvities(
  aarpRewardsTab: chrome.tabs.Tab
): AsyncGenerator<AarpActivity, void, undefined> {
  if (!isAarpTab(aarpRewardsTab.url))
    throw new Error("Tab must be in the AARP domain to parse activities");

  const getPageNumber = (): number => {
    const match = aarpRewardsTab.url!.match(/#page=(\d+)/);
    return (match && Number(match[1])) ?? 1;
  };
  const changePageQuerySelectors = {
    input:
      ".dynamic-pagination__jump-to-page-container > input#dynamic-pagination__jump-to-page-container__input-text[type='number']",
    button:
      ".dynamic-pagination__jump-to-page-container > button.dynamic-pagination__jump-to-page-button",
  };

  let pageNumber = 1;
  while (pageNumber === getPageNumber()) {
    const content: Extract<MessageResponse, { action: "getContent" }> =
      await sendMessageAync(aarpRewardsTab.id!, {
        action: "getContent",
      } satisfies MessageRequest);

    const parser = new DOMParser();
    const html = parser.parseFromString(content.source, "text/html");

    const activityElements = html.querySelectorAll(
      "ul.rewards-c-earn-list__list[data-paginationinfo-id='earn-list'] > li > a"
    );
    yield* [...activityElements.values()].map((element): AarpActivity => {
      const type = element.getAttribute("data-activitytype")!;
      if (!["video", "quiz"].includes(type))
        throw new Error("Invalid activity type when parsing");
      return {
        type: type as "video" | "quiz",
        id: element.getAttribute("data-activity-identifier")!,
        url: element.getAttribute("href")!,
      };
    });

    pageNumber++;
    await sendMessageAync(aarpRewardsTab.id!, {
      action: "input",
      elementQuery: changePageQuerySelectors.input,
      text: pageNumber.toString(),
    } satisfies MessageRequest);
    await sendMessageAync(aarpRewardsTab.id!, {
      action: "click",
      elementQuery: changePageQuerySelectors.button,
    } satisfies MessageRequest);
  }
}

/**
 * This is the main function for getting the video rewards. Some AARP server somewhere
 * gives rewards to an account when a single POST request is sent to it with the proper
 * authentication, so we're just gonna send it so we don't have to watch the video.
 *
 * @param activity Acitivitiy object containing necessary info like the activity ID (can get from `getActivities()`)
 * @throws NotLoggedInError if not logged into AARP, Error if POST rejected, Zod error if unexpected JSON response
 */
export async function earnVideoRewards(
  aarpTab: chrome.tabs.Tab,
  activity: WithFixedProperties<AarpActivity, { type: "video" }>
): Promise<{
  success: boolean;
  pointsEarned: number;
  dailyPointsLeft: number;
}> {
  if (!isAarpTab(aarpTab.url))
    throw new Error("Tab must be in the AARP domain to earn video rewards");

  const user = await getUser(aarpTab);
  if (!user)
    throw new NotLoggedInError(
      "You must be signed into AARP to earn video rewards",
      LOGIN_URL
    );

  const activityRewardsUrl = `https://services.share.aarp.org/applications/loyalty-catalog/activity/usergroup/member/user/${user.fedId}/${activity.id}`;

  const response = await fetch(activityRewardsUrl, {
    method: "POST",
    headers: {
      Authorization: user.accessToken,
      "Content-Length": "2",
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: ORIGIN,
      Referer: activity.url,
      "User-Agent": navigator.userAgent,
      "X-Loyalty-Backend": "LoyaltyPlus",
    },
    body: "{}",
  });

  if (!response.ok)
    throw new Error("Video rewards POST rejected by AARP server");

  const data = RewardsResponseSchema.parse(await response.json());
  return {
    success:
      data.success && data.awarded && data.activityCompleted === activity.id,
    pointsEarned: data.pointsEarned,
    dailyPointsLeft: data.userDailyPointsLeft,
  };
}
