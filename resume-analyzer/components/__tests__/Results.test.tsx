import { fireEvent, render, screen } from '@testing-library/react';
import Results from '../Results';
import { sampleAnalysis } from '@/lib/__fixtures__/analysis';

describe('Results', () => {
  it('shows scores, feedback and switches between tabs', () => {
    render(<Results analysis={sampleAnalysis} onReset={jest.fn()} />);

    expect(screen.getByLabelText('Overall: 72 out of 100')).toBeInTheDocument();
    expect(screen.getByText('Clear progression across three roles')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Job match' }));
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'ATS check (1)' }));
    expect(screen.getByText('Two-column layout')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Rewrites (1)' }));
    expect(screen.getByText('Built 12 REST APIs serving [N] requests/day')).toBeInTheDocument();
  });

  it('hides the job match tab when no job description was given', () => {
    render(<Results analysis={{ ...sampleAnalysis, jobMatch: null }} onReset={jest.fn()} />);
    expect(screen.queryByRole('tab', { name: 'Job match' })).not.toBeInTheDocument();
  });
});
