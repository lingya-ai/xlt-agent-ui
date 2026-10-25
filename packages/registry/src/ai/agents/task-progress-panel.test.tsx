import {render, screen} from '@testing-library/react';
import {it, expect} from 'vitest';
import {TaskProgressPanel} from './task-progress-panel';
import {TASK_STATUS} from '../hooks/use-chat/schema';

it('展示 SDK 任务 content 并按执行状态排序', () => {
  render(<TaskProgressPanel defaultOpen progress={{
    action: 'replace', total: 2, pending: 1, inProgress: 1, completed: 0, progressPercent: 0,
    tasks: [
      {id: '1', content: '等待汇总', status: TASK_STATUS.PENDING},
      {id: '2', content: '正在查询', status: TASK_STATUS.IN_PROGRESS},
    ],
  }}/>);
  const running = screen.getByText('正在查询');
  const pending = screen.getByText('等待汇总');
  expect(running.compareDocumentPosition(pending) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
