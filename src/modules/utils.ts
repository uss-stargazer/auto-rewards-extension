export type WithFixedProperties<
  T,
  FixedObject extends { [key: string]: any }
> = Omit<T, keyof FixedObject> & FixedObject;

export function sendMessageAync(tabId: number, message: any): Promise<any> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      resolve(response);
    });
  });
}
