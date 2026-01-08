# AutoRewards Extension

A Chrome extension to automate gathering rewards for a handful of platforms (for example, Microsoft Rewards).

## Supported Platforms

- ### [AARP Rewards](https://www.aarp.org/rewards/)

  - Requires that user login to AARP
  - On run
    - Navigate to rewards dashboard
    - Parse rewards dashboard for all quizzes and videos
      - All activities are in a big list (`ul` with `data-paginationinfo-id="earn-list"`)
      - Each activity is a `li > a`
        - `data-activitytype` is either `video` or `quiz`
        - `data-activity-identifier` is $ACTIVITYID
    - For videos
      - Required info
        - `Authorization` header is constant that is generated at the dashboard page; it can be accessed from a lot of the request headers at the dashboard page
        - The $USERID which is probably recieved well before the rewards page; it can be accessed by first GET request to `https://services.share.aarp.org/applications/loyalty-catalog/user/$USERID/fitness/profile`
      - A single POST request to `https://services.share.aarp.org/applications/loyalty-catalog/activity/usergroup/member/user/$USERID/$ACTIVITYID` with the proper authentication is all that is necessary to get the points for that activity
      - idk if these headers are necessary
        - `cd: { customerSessionID: Earn-u16ratwzxnc0pimdd5cta, emailAddress: dohel27358@roratu.com }`
        - `X-Loyalty-Backend: LoyaltyPlus`
