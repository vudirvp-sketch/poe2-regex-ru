// @vitest-environment jsdom
/**
 * React component tests for PageStateWrapper.
 *
 * Tests the three states: loading, error, no-data, and the happy path
 * where data is passed to children via render prop.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';

describe('PageStateWrapper', () => {
  it('shows loading spinner when loading=true', () => {
    render(
      <PageStateWrapper loading={true} error={null} data={null}>
        {() => <div>content</div>}
      </PageStateWrapper>
    );

    // Should show loading indicator with role="status"
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    // Should contain loading text
    expect(status).toHaveTextContent(/загруз/i);
    // Children should NOT be rendered
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('shows error alert when error is non-null', () => {
    render(
      <PageStateWrapper loading={false} error="Network failure" data={null}>
        {() => <div>content</div>}
      </PageStateWrapper>
    );

    // Should show error alert with role="alert"
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/ошибка/i);
    expect(alert).toHaveTextContent(/Network failure/);
    // Children should NOT be rendered
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('shows no-data message when data is null (no error, not loading)', () => {
    render(
      <PageStateWrapper loading={false} error={null} data={null}>
        {() => <div>content</div>}
      </PageStateWrapper>
    );

    // Should show no-data status
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/нет данных/i);
  });

  it('renders children with data when data is present', () => {
    const testData = { name: 'Test Item', value: 42 };

    render(
      <PageStateWrapper loading={false} error={null} data={testData}>
        {(data) => <div>{data.name}: {data.value}</div>}
      </PageStateWrapper>
    );

    // Children should be rendered with the data
    expect(screen.getByText('Test Item: 42')).toBeInTheDocument();
    // No loading/error/no-data states should be visible
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prioritizes loading over error state', () => {
    render(
      <PageStateWrapper loading={true} error="Some error" data={null}>
        {() => <div>content</div>}
      </PageStateWrapper>
    );

    // Loading takes priority over error
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/загруз/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prioritizes loading over data', () => {
    const testData = { name: 'Test' };

    render(
      <PageStateWrapper loading={true} error={null} data={testData}>
        {(data) => <div>{data.name}</div>}
      </PageStateWrapper>
    );

    // Should show loading, not data
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });

  it('prioritizes error over no-data when data is null', () => {
    render(
      <PageStateWrapper loading={false} error="Fail" data={null}>
        {() => <div>content</div>}
      </PageStateWrapper>
    );

    // Error shown, not "no data"
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('works with complex data types (arrays)', () => {
    const testData = [1, 2, 3];

    render(
      <PageStateWrapper loading={false} error={null} data={testData}>
        {(data) => <div>Count: {data.length}</div>}
      </PageStateWrapper>
    );

    expect(screen.getByText('Count: 3')).toBeInTheDocument();
  });

  it('works with string data type', () => {
    render(
      <PageStateWrapper loading={false} error={null} data="hello">
        {(data) => <div>Got: {data}</div>}
      </PageStateWrapper>
    );

    expect(screen.getByText('Got: hello')).toBeInTheDocument();
  });
});
