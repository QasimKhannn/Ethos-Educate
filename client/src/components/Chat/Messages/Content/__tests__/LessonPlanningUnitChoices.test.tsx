import { Constants, ContentTypes } from 'librechat-data-provider';
import {
  getLessonPlanningSuggestionChoices,
  getLessonPlanningUnitChoices,
} from '../LessonPlanningUnitChoices';

describe('getLessonPlanningUnitChoices', () => {
  test('extracts unit choices from wrapped lesson-planning MCP output', () => {
    const content = [
      {
        type: ContentTypes.TOOL_CALL,
        [ContentTypes.TOOL_CALL]: {
          name: `lesson_get_units${Constants.mcp_delimiter}lesson-planning`,
          output: JSON.stringify([
            {
              type: 'text',
              text: JSON.stringify([
                { label: 'Unit 1', value: 'unit-1' },
                { label: 'Unit 2', value: 'unit-2' },
              ]),
            },
          ]),
        },
      },
      {
        type: ContentTypes.TEXT,
        text: 'Please choose one unit.',
      },
    ] as any;

    expect(getLessonPlanningUnitChoices(content)).toEqual([
      { label: 'Unit 1', value: 'unit-1' },
      { label: 'Unit 2', value: 'unit-2' },
    ]);
  });

  test('ignores plain non-json tool output without recursing forever', () => {
    const content = [
      {
        type: ContentTypes.TOOL_CALL,
        [ContentTypes.TOOL_CALL]: {
          name: `lesson_get_units${Constants.mcp_delimiter}lesson-planning`,
          output: 'No units found.',
        },
      },
      {
        type: ContentTypes.TEXT,
        text: 'Please choose one unit.',
      },
    ] as any;

    expect(getLessonPlanningUnitChoices(content)).toEqual([]);
  });

  test('does not show choices for other MCP servers', () => {
    const content = [
      {
        type: ContentTypes.TOOL_CALL,
        [ContentTypes.TOOL_CALL]: {
          name: `lesson_get_units${Constants.mcp_delimiter}other-server`,
          output: JSON.stringify([{ label: 'Unit 1', value: 'unit-1' }]),
        },
      },
      {
        type: ContentTypes.TEXT,
        text: 'Please choose one unit.',
      },
    ] as any;

    expect(getLessonPlanningUnitChoices(content)).toEqual([]);
  });
});

describe('getLessonPlanningSuggestionChoices', () => {
  test('extracts benchmark and strategy choices from wrapped lesson-planning MCP output', () => {
    const content = [
      {
        type: ContentTypes.TOOL_CALL,
        [ContentTypes.TOOL_CALL]: {
          name: `lesson_generate_suggestions${Constants.mcp_delimiter}lesson-planning`,
          output: JSON.stringify([
            {
              type: 'text',
              text: JSON.stringify({
                benchmarks: [
                  {
                    id: 'benchmark_1',
                    title: 'SC.K.P.10.1 - Observe that things that make sound vibrate.',
                    description: 'Observe that things that make sound vibrate.',
                  },
                ],
                engagement_strategies: [
                  {
                    title: 'Sound Vibration Stations',
                    description: 'Observe vibrating parts and loud/soft sounds.',
                  },
                ],
              }),
            },
          ]),
        },
      },
      {
        type: ContentTypes.TEXT,
        text: 'Choose benchmarks and engagement strategies.',
      },
    ] as any;

    expect(getLessonPlanningSuggestionChoices(content)).toEqual({
      benchmarks: [
        {
          label: 'SC.K.P.10.1 - Observe that things that make sound vibrate.',
          value: 'SC.K.P.10.1 - Observe that things that make sound vibrate.',
          description: 'Observe that things that make sound vibrate.',
        },
      ],
      strategies: [
        {
          label: 'Sound Vibration Stations',
          value: 'Sound Vibration Stations',
          description: 'Observe vibrating parts and loud/soft sounds.',
        },
      ],
    });
  });

  test('does not extract suggestions from other MCP servers', () => {
    const content = [
      {
        type: ContentTypes.TOOL_CALL,
        [ContentTypes.TOOL_CALL]: {
          name: `lesson_generate_suggestions${Constants.mcp_delimiter}other-server`,
          output: JSON.stringify({
            benchmarks: [{ title: 'Benchmark 1' }],
            engagement_strategies: [{ title: 'Strategy 1' }],
          }),
        },
      },
      {
        type: ContentTypes.TEXT,
        text: 'Choose benchmarks and engagement strategies.',
      },
    ] as any;

    expect(getLessonPlanningSuggestionChoices(content)).toBeNull();
  });
});
