/**
 * Test setup — loaded before all test files.
 *
 * Extends vitest expect with @testing-library/jest-dom matchers
 * (toBeVisible, toHaveTextContent, toBeDisabled, etc.) for React component tests.
 */
import '@testing-library/jest-dom/vitest';
