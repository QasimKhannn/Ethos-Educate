import { tool } from '@langchain/core/tools';
import {
  createLocalProgrammaticToolCallingTool,
  normalizeToPythonIdentifier,
  unwrapProgrammaticToolResponse,
} from './localProgrammaticToolCalling';

describe('localProgrammaticToolCalling', () => {
  describe('normalizeToPythonIdentifier', () => {
    it('normalizes hyphens and python keywords', () => {
      expect(normalizeToPythonIdentifier('my-tool')).toBe('my_tool');
      expect(normalizeToPythonIdentifier('class')).toBe('class_tool');
    });
  });

  describe('unwrapProgrammaticToolResponse', () => {
    it('parses MCP text tuples into raw values', () => {
      expect(
        unwrapProgrammaticToolResponse(['{"count":2}', { ignored: true }], true),
      ).toEqual({ count: 2 });
    });
  });

  describe('createLocalProgrammaticToolCallingTool', () => {
    it('runs python code that calls an existing tool through the local bridge', async () => {
      const localTool = tool(
        async ({ value }: { value: number }) => `value:${value * 2}`,
        {
          description: 'Doubles a value',
          name: 'double-value',
          schema: {
            properties: {
              value: {
                type: 'number',
              },
            },
            required: ['value'],
            type: 'object',
          },
        },
      );

      const ptcTool = createLocalProgrammaticToolCallingTool({});
      const rawResult = await ptcTool.invoke(
        {
          code: `
result = await double_value(value=21)
print(result)
`,
        },
        {
          toolCall: {
            toolDefs: [
              {
                allowed_callers: ['code_execution'],
                description: 'Doubles a value',
                name: 'double-value',
                parameters: {
                  properties: {
                    value: {
                      type: 'number',
                    },
                  },
                  required: ['value'],
                  type: 'object',
                },
              },
            ],
            toolMap: new Map([['double-value', localTool]]),
          },
        },
      );
      const result = rawResult as {
        artifact?: { files?: Array<{ name: string }> };
        content: string;
      };

      expect(result.content).toContain('stdout:');
      expect(result.content).toContain('value:42');
      expect(result.artifact).toBeUndefined();
    });
  });
});
