'use client';

import { Component, type ReactNode } from 'react';

// Keeps one part of a page from taking the whole page down: if something inside throws while drawing, only this part shows a
// short message with "Try again"; the rest of the page keeps working. The error goes to the browser console with the part's
// name and the request code only, never the data being shown.
interface Props { section: string; requestCode?: string; resetKey?: string; children: ReactNode }
interface State { failed: boolean; resetKey?: string }

export const SECTION_ERROR_TEXT = "This part of the request couldn't be shown. The rest of the page still works.";

export default class SectionErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  // Another request opened in the same place: start clean.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    console.error(`${this.props.section} could not be shown${this.props.requestCode ? ` (${this.props.requestCode})` : ''}:`, error instanceof Error ? error.message : 'unknown error');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <p className="text-sm font-bold">{this.props.section}</p>
        <p className="mt-1 text-[13px]">{SECTION_ERROR_TEXT}</p>
        <button type="button" onClick={() => this.setState({ failed: false })} className="mt-3 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">
          Try again
        </button>
      </div>
    );
  }
}

/**
 * Draws `render()` as its own child, so an error thrown while building that markup is caught by a SectionErrorBoundary around
 * it (markup built inline in the parent's render would throw in the parent, past the boundary).
 */
export function RenderSection({ render }: { render: () => ReactNode }) {
  return <>{render()}</>;
}
