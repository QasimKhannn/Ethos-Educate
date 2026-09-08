export type ImageGenerationTextPresentation = Readonly<{
  text: string;
  showIncompleteNotice: boolean;
}>;

const leakedImageGenerationToolPayload =
  /(?:^|\r?\n)Tool:\s*generate_images(?:_mcp_Image_Generation)?\s*,\s*\[\s*\{\s*"type"\s*:\s*"text"\s*,\s*"text"\s*:/i;

/** Removes model-written MCP payloads, which are not completed tool calls. */
export function getImageGenerationTextPresentation(
  text: string,
  hasImageGenerationResult: boolean,
): ImageGenerationTextPresentation {
  const match = leakedImageGenerationToolPayload.exec(text);
  if (match?.index == null) {
    return { text, showIncompleteNotice: false };
  }

  const visibleText = text.slice(0, match.index).trimEnd();
  if (hasImageGenerationResult) {
    return { text: visibleText, showIncompleteNotice: false };
  }

  return { text: '', showIncompleteNotice: true };
}
