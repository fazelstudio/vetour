/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  ErrorBoundary.tsx
 *  React error boundary with a retryable fallback view.
 *-----------------------------------------------------------------------------------------------*/

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-full p-8 bg-background">
          <div className="text-center max-w-md">
            <p className="text-lg font-semibold text-danger mb-2">Something went wrong</p>
            <pre className="text-xs text-text-secondary bg-surface rounded-lg p-4 border border-border overflow-auto text-left whitespace-pre-wrap">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary-hover"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}