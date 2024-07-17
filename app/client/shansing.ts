import { modelThresholdTokenNumbers } from "@/app/constant";

export function calculatePromptTokenThreshold(
  model: string,
  maxCompletionToken: number,
  knownPromptNumber: number,
) {
  const modelThresholdTokenNumber = modelThresholdTokenNumbers?.find((obj) =>
    model.startsWith(obj.name),
  );
  if (modelThresholdTokenNumber?.total != null) {
    return (
      modelThresholdTokenNumber.total - maxCompletionToken - knownPromptNumber
    );
  } else if (modelThresholdTokenNumber?.prompt != null) {
    return modelThresholdTokenNumber.prompt - knownPromptNumber;
  } else {
    return 4000 - maxCompletionToken - knownPromptNumber;
  }
}

export function fitMaxCompletionToken(model: string, givenMaxTokens: number) {
  if (givenMaxTokens == null) {
    return 500;
  }
  const modelThresholdTokenNumber = modelThresholdTokenNumbers?.find((obj) =>
    model.startsWith(obj.name),
  );
  const maxCompletionToken = modelThresholdTokenNumber?.completion;
  if (maxCompletionToken == null) {
    return givenMaxTokens;
  }
  return givenMaxTokens > maxCompletionToken
    ? maxCompletionToken
    : givenMaxTokens;
}

export function extractErrorMessage(text: string) {
  try {
    if (!text || !text.trim()) {
      return "";
    }

    const openTag = text.toLowerCase().indexOf("<h1>");
    const closeTag = text.toLowerCase().indexOf("</h1>");
    if (openTag !== -1 && closeTag !== -1) {
      return text.substring(openTag + 4, closeTag);
    }

    let obj;
    const openBracket = text.indexOf("{");
    const closeBracket = text.lastIndexOf("}");
    if (openBracket !== -1 && closeBracket !== -1) {
      const jsonString = text.substring(openBracket, closeBracket + 1);
      try {
        obj = JSON.parse(jsonString);
      } catch (ignored) {}
    }
    if (!obj && !text.trim().startsWith("{")) {
      return text;
    }

    if (!obj) {
      return "";
    }
    let candidateMessage: string | null = null;
    function traverse(obj: object) {
      for (let key in obj) {
        if (!obj.hasOwnProperty(key)) {
          continue;
        }
        if (
          (key === "message" || key === "msg") &&
          // @ts-ignore
          typeof obj[key] === "string"
        ) {
          // @ts-ignore
          candidateMessage = obj[key];
          return; // If we found a message directly, no need to continue the loop
          // @ts-ignore
        } else if (
          key.includes("err") &&
          // @ts-ignore
          typeof obj[key] === "string" &&
          !candidateMessage
        ) {
          // @ts-ignore
          candidateMessage = obj[key];
          // @ts-ignore
        } else if (typeof obj[key] === "object") {
          // @ts-ignore
          traverse(obj[key]); // Recursively check nested objects
        }
      }
    }
    traverse(obj);

    return candidateMessage || "";
  } catch (error) {
    return "";
  }
}
// console.log(extractErrorMessage('{"error": {"type": "overloaded_error", "message": "🙂过载"}}  '))
// console.log(extractErrorMessage('data: {"error": {"type": "overloaded_error", "message": "🙂Overloaded!"}}  '))
// console.log(extractErrorMessage('{"status":"-1", "error": "bad!", "message": "🙂It\'s me!"}'))
// console.log(extractErrorMessage(' {"status":"-1", "error": "🙂error!"}  '))
// console.log(extractErrorMessage('<html><meta charset="utf-8" /><head><title>401 Authorization Required</title></head><body><center><h1>🙂401 Authorization Required</h1></center><hr><center>nginx</center></body></html>'))
// console.log(extractErrorMessage('🙂Mario'))
