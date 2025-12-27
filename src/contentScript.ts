const hostNames

chrome.tabs.getCurrent().then((currentTab) => {
  if (!currentTab.url) return
  const currentUrl = new URL(currentTab.url) 
  if ()
})