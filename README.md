# AutoRewards Extension

A Chrome extension to automate gathering rewards for a handful of platforms (for example, Microsoft Rewards).

## Installation

### Install on desktop

Unpack the extension:

- **Option 1**: Get the latest zip release from the releases page and unzip the archive in desired location (for example, `$HOME/Documents/AutoRewards/`).

- **Option 2**: Clone this repo and run `npm install && npm run build`. The `dist/` directory should be created and will be used as the extension.

Next, both Google Chrome and Microsoft Edge support Chrome extensions, so for either:

- Three dots in right corner of browser > `Extensions` > `Manage Extensions`
- Turn on developer mode (there should be a switch somewhere)
- Use the `Load unpacked` button and give it the directory you built in one of the above options

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

## TODO

- mobile accessiblility
- get all button
- more activity types
- filtering
