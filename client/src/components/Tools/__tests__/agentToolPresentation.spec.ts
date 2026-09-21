import { formatToolDescription, formatToolDisplayName } from '../agentToolPresentation';

describe('agent tool presentation', () => {
  it('uses a readable fallback for function identifiers', () => {
    expect(formatToolDisplayName('create_data_chart')).toBe('Create Data Chart');
    expect(formatToolDisplayName('generatePodcastMP3')).toBe('Generate Podcast MP3');
  });

  it('preserves a provider-supplied title', () => {
    expect(formatToolDisplayName('Create a classroom chart')).toBe('Create a classroom chart');
  });

  it('removes API parameter documentation from a tool description', () => {
    expect(formatToolDescription('Search approved resources. Args: query: The search term.')).toBe(
      'Search approved resources.',
    );
  });
});
