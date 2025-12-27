export type MessageRequest =
  | { action: "getContent" }
  | { action: "click"; elementQuery: string }
  | {
      action: "input";
      elementQuery: string;
      text: string;
    };

export type MessageResponse = {
  action: "getContent";
  source: string;
};

function contentScript() {
  chrome.runtime.onMessage.addListener(
    (request: MessageRequest, sender, sendResponse) => {
      if (request.action === "getContent") {
        const source = document.documentElement.outerHTML;
        sendResponse({
          action: "getContent",
          source: source,
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
          throw new Error(
            "Element selected from query is not an input element"
          );
        element.value = request.text;
        sendResponse();
      }
    }
  );
}

export default {
  rootHost: "aarp.org",
  contentScript: contentScript,
};
