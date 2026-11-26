import { Navigate } from 'react-router';

/** 任务中心已经撤掉。破境的准备写在静室里，旧地址转过去。 */
export default function TasksRedirect() {
  return <Navigate to="/game/retreat" replace />;
}
