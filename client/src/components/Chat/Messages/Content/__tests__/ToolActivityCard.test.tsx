import { act, render, screen } from '@testing-library/react';
import ToolActivityCard from '../ToolActivityCard';
import { getToolActivityPresentation } from '../toolPresentation';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('ToolActivityCard', () => {
  const onToggleDetails = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the image presentation and rotates its friendly phrases while working', () => {
    render(
      <ToolActivityCard
        hasDetails={true}
        isExpanded={false}
        onToggleDetails={onToggleDetails}
        presentation={getToolActivityPresentation('generate_images', 'Image_Generation')}
        status="working"
      />,
    );

    expect(screen.getByText('com_ui_tool_activity_image_title')).toBeInTheDocument();
    expect(screen.getByText('com_ui_tool_activity_image_phrase_one')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    expect(screen.getByText('com_ui_tool_activity_image_phrase_two')).toBeInTheDocument();
  });

  it('shows a distinct failed state instead of cancelled', () => {
    render(
      <ToolActivityCard
        hasDetails={false}
        isExpanded={false}
        onToggleDetails={onToggleDetails}
        presentation={getToolActivityPresentation('create_document', 'Downloadable-Files-Creation')}
        status="failed"
      />,
    );

    expect(screen.getByText('com_ui_tool_activity_failed')).toBeInTheDocument();
    expect(screen.getByText('com_ui_tool_activity_problem_guidance')).toBeInTheDocument();
  });
});
