import {
  createStudentCopyHtml,
  getCompleteAdaptedStudentPlainText,
  parseDifferentiationAdapterResponse,
} from '../differentiationAdapterResponse';

describe('parseDifferentiationAdapterResponse', () => {
  const response = {
    responseType: 'differentiation_adapter',
    learningObjective: 'Explain how ocean temperature affects weather patterns.',
    comparisonRows: [
      {
        original: 'Ocean temperatures can influence weather patterns.',
        adapted: 'Warm ocean water can change the weather.',
        change: 'Used shorter, familiar words.',
      },
    ],
    adaptedStudentCopy: {
      title: 'El Niño y el tiempo',
      plainText: 'Directions\n\nRead the passage. Then answer the questions.',
      html: '<h1>El Niño y el tiempo</h1><p>Directions</p>',
    },
    teacherReviewFlags: ['Added English-Spanish vocabulary support.'],
    download: {
      filename: 'el_nino_weather.docx',
      url: '/api/files/download/user/file',
    },
  };

  it('accepts the complete differentiation adapter contract', () => {
    expect(parseDifferentiationAdapterResponse(JSON.stringify(response))).toEqual(response);
  });

  it('accepts a JSON-fenced response', () => {
    expect(
      parseDifferentiationAdapterResponse(`\`\`\`json\n${JSON.stringify(response)}\n\`\`\``),
    ).toEqual(response);
  });

  it('does not treat another structured response as a differentiation response', () => {
    expect(parseDifferentiationAdapterResponse('{"responseType":"lesson_plan"}')).toBeNull();
  });

  it('makes the title part of the copied plain text when it is not in plainText', () => {
    expect(
      getCompleteAdaptedStudentPlainText({
        title: 'El Niño y el tiempo',
        plainText: 'Directions\n\nLee el pasaje.',
      }),
    ).toBe('El Niño y el tiempo\n\nDirections\n\nLee el pasaje.');
  });

  it('does not mistake a passage that starts with the title for a title line', () => {
    expect(
      getCompleteAdaptedStudentPlainText({
        title: 'Water',
        plainText: 'Water is important for every living thing.',
      }),
    ).toBe('Water\n\nWater is important for every living thing.');
  });

  it('does not repeat the title in generated HTML when HTML is not supplied', () => {
    expect(
      createStudentCopyHtml({
        title: 'El Ni\u00f1o y el tiempo',
        plainText: 'Directions: Read the passage.\n\nEl Ni\u00f1o can affect weather.',
      }),
    ).toBe('<p>Directions: Read the passage.</p><p>El Ni\u00f1o can affect weather.</p>');
  });
});
