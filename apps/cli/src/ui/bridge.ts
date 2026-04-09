/**
 * Bridges @frontagent/core AgentEvent emissions to the UI store.
 *
 * Each event handler writes only the minimal state change so that
 * React only re-renders the affected subtree.
 */

import type { AgentEvent } from '@frontagent/core';
import type { Store } from './store.js';

export function createEventBridge(store: Store) {
  return (event: AgentEvent) => {
    switch (event.type) {
      case 'task_started':
        store.setState({
          status: 'scanning',
          taskDescription: event.task.description,
          startTime: Date.now(),
        });
        break;

      case 'rag_retrieved':
        store.setState({
          ragMatches: event.matches.map((m) => ({
            title: m.title,
            path: m.path,
          })),
          ragSearchMode: event.searchMode ?? null,
          ragReranked: event.reranked ?? false,
          ragWarnings: event.warnings ?? [],
        });
        break;

      case 'planning_started':
        store.setState({ status: 'planning' });
        break;

      case 'planning_completed':
        store.setState({
          status: 'executing',
          plan: event.plan,
          phases: store.buildPhasesFromPlan(event.plan),
        });
        break;

      case 'phase_started':
        store.markPhaseActive(event.phase);
        break;

      case 'phase_completed':
        store.markPhaseDone(event.phase);
        break;

      case 'step_started':
        store.updateStepStatus(event.step.stepId, 'running');
        store.setState({ currentStepId: event.step.stepId });
        break;

      case 'step_completed':
        store.updateStepStatus(event.step.stepId, 'completed');
        store.setState({ currentStepId: null });
        break;

      case 'step_failed':
        store.updateStepStatus(event.step.stepId, 'failed', event.error);
        store.setState({ currentStepId: null });
        break;

      case 'task_completed':
        store.setState({
          status: 'done',
          result: event.result,
        });
        break;

      case 'task_failed':
        store.setState({
          status: 'error',
        });
        break;

      default:
        break;
    }
  };
}
