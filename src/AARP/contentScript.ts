export type MessageRequest =
  | { action: "getContent" }
  | { action: "getLocalStorage"; key: string }
  | { action: "click"; elementQuery: string }
  | {
      action: "input";
      elementQuery: string;
      text: string;
    };

export type MessageResponse =
  | {
      action: "getContent";
      source: string;
    }
  | { action: "getLocalStorage"; value: string | null };

chrome.runtime.onMessage.addListener(
  (request: MessageRequest, sender, sendResponse) => {
    if (request.action === "getContent") {
      const source = document.documentElement.outerHTML;
      sendResponse({
        action: "getContent",
        source: source,
      } satisfies MessageResponse);
    } else if (request.action === "getLocalStorage") {
      sendResponse({
        action: "getLocalStorage",
        value: window.localStorage.getItem(request.key),
      } satisfies MessageResponse);
    } else if (request.action === "click") {
      const element = document.querySelector<HTMLElement>(
        request.elementQuery
      )!;
      element.click();
      sendResponse();
    } else if (request.action === "input") {
      const element = document.querySelector<HTMLInputElement>(
        request.elementQuery
      )!;
      if (element.tagName !== "input")
        throw new Error("Element selected from query is not an input element");
      element.value = request.text;
      sendResponse();
    }
  }
);
