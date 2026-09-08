import { getImageGenerationTextPresentation } from '../imageGenerationResponse';

const leakedPayload = [
  'Your new image is ready.',
  'Tool: generate_images_mcp_Image_Generation, [{"type":"text","text":"Generated 1 image."}]',
].join('\n');

describe('getImageGenerationTextPresentation', () => {
  test('replaces a model-written tool payload with a retry state when no result exists', () => {
    expect(getImageGenerationTextPresentation(leakedPayload, false)).toEqual({
      text: '',
      showIncompleteNotice: true,
    });
  });

  test('preserves the assistant message while removing a duplicate payload after a real result', () => {
    expect(getImageGenerationTextPresentation(leakedPayload, true)).toEqual({
      text: 'Your new image is ready.',
      showIncompleteNotice: false,
    });
  });

  test('leaves normal assistant text unchanged', () => {
    expect(getImageGenerationTextPresentation('Your image is ready.', false)).toEqual({
      text: 'Your image is ready.',
      showIncompleteNotice: false,
    });
  });
});
