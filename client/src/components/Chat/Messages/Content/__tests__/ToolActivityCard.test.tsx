import { fireEvent, render, screen } from '@testing-library/react';
import ToolActivityCard from '../ToolActivityCard';
import { getToolActivityPresentation } from '../toolPresentation';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('ToolActivityCard', () => {
  const onToggleDetails = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders one compact shimmering image status while working', () => {
    const { container } = render(
      <ToolActivityCard
        hasDetails={true}
        isExpanded={false}
        onToggleDetails={onToggleDetails}
        presentation={getToolActivityPresentation('generate_images', 'Image_Generation')}
        status="working"
      />,
    );

    expect(screen.getByText('com_ui_tool_activity_image_title')).toBeInTheDocument();
    expect(screen.getByText('com_ui_tool_activity_image_title')).toHaveClass('shimmer');
    expect(container.querySelector('[data-tool-activity-category="image"]')).not.toHaveClass(
      'border',
    );
    expect(container.querySelector('[data-tool-activity-category="image"]')).not.toHaveClass(
      'rounded-xl',
    );
    expect(
      container.querySelector('[data-tool-activity-category="image"] .animate-pulse'),
    ).toBeNull();
  });

  it('keeps technical details accessible from the compact status', () => {
    render(
      <ToolActivityCard
        hasDetails={true}
        isExpanded={false}
        onToggleDetails={onToggleDetails}
        presentation={getToolActivityPresentation('create_document', 'Downloadable-Files-Creation')}
        status="working"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_tool_activity_technical_details' }));

    expect(onToggleDetails).toHaveBeenCalledTimes(1);
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
