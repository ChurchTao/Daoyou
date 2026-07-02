import {
  InkActionGroup,
  InkButton,
  InkNotice,
} from '@app/components/ui';
import { useNavigate } from 'react-router';
import {
  getPendingCreationConfig,
  getPendingCreationNoticeText,
  type PendingCreationCraftType,
} from './pendingCreationHelpers';

export function PendingCreationNotice({
  pendingTypes,
  loading = false,
  className = '',
}: {
  pendingTypes: readonly PendingCreationCraftType[];
  loading?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();

  if (loading || pendingTypes.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <InkNotice tone="warning">
        {pendingTypes.length === 1
          ? getPendingCreationNoticeText(pendingTypes[0]!)
          : '已有多门待纳入道基的新法门，请先处理取舍。'}
      </InkNotice>
      <InkActionGroup align="right">
        {pendingTypes.map((craftType) => {
          const config = getPendingCreationConfig(craftType);
          return (
            <InkButton
              key={craftType}
              variant="secondary"
              onClick={() => navigate(config.replaceHref)}
            >
              处理{config.label}
            </InkButton>
          );
        })}
      </InkActionGroup>
    </div>
  );
}
