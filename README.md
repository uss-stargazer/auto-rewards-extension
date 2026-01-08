# AutoRewards Extension

A Chrome extension to automate gathering rewards for a handful of platforms (for example, Microsoft Rewards).

## Supported Platforms

- ### [AARP Rewards](https://www.aarp.org/rewards/)

  - Requires that user login to AARP
  - Queries AARP API with user accessToken to do the following:
    - List available activties
    - Check activity status (complete/incomplete)
    - Perhaps most importantly, **earn rewards for activity**. Supported activities:
      - video
  - Useful UI for filtering activities if you still want to complete them for enjoyment
    (but now you don't have to worry about getting rewards!)
