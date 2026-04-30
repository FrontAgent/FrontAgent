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
        store.recordActivity('任务已启动', '初始化任务');
        break;

      case 'status_update':
        store.recordActivity(event.label, event.operation ?? event.label);
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
        store.recordActivity('知识库检索完成', '规划准备');
        break;

      case 'planning_started':
        store.setState({ status: 'planning' });
        store.recordActivity('开始规划', '生成执行计划');
        break;

      case 'planning_completed':
        store.setState({
          status: 'executing',
          plan: event.plan,
          phases: store.buildPhasesFromPlan(event.plan),
        });
        store.recordActivity('规划完成', '执行工具步骤');
        break;

      case 'phase_started':
        store.markPhaseActive(event.phase);
        store.recordActivity(`阶段开始：${event.phase}`, `执行阶段：${event.phase}`);
        break;

      case 'phase_completed':
        store.markPhaseDone(event.phase);
        store.recordActivity(`阶段完成：${event.phase}`, '阶段收尾');
        break;

      case 'step_started':
        store.upsertStep(event.step, 'running');
        store.setState({ currentStepId: event.step.stepId });
        store.recordActivity(`工具开始：${event.step.tool}`, `${event.step.tool} ${event.step.description}`);
        break;

      case 'step_completed':
        store.upsertStep(event.step, 'completed');
        store.setState({ currentStepId: null });
        store.recordActivity(`工具完成：${event.step.tool}`, '等待下一步');
        break;

      case 'step_failed':
        store.upsertStep(event.step, 'failed', event.error);
        store.setState({ currentStepId: null });
        store.recordActivity(`工具失败：${event.step.tool}`, '处理工具错误');
        break;

      case 'task_completed':
        store.recordActivity('任务完成', null);
        store.setState({
          status: event.result.success ? 'done' : 'error',
          result: event.result,
        });
        break;

      case 'task_failed':
        store.recordActivity('任务失败', null);
        store.setState({
          status: 'error',
        });
        break;

      default:
        break;
    }
  };
}
