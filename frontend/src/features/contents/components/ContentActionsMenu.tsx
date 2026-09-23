import { Copy, Eye, ListBullets } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../app/providers/ToastProvider';
import { ActionMenu } from '../../../shared/components/ActionMenu';
import { copyText } from '../../../shared/lib/clipboard';

export function ContentActionsMenu({ contentId }: { contentId: string }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <ActionMenu
      label="Open content actions"
      items={[
        {
          label: 'View details',
          icon: <Eye size={17} aria-hidden="true" />,
          onSelect: () => navigate(`/contents/${contentId}`),
        },
        {
          label: 'View moderation',
          icon: <ListBullets size={17} aria-hidden="true" />,
          onSelect: () => navigate(`/contents/${contentId}#moderation`),
        },
        {
          label: 'Copy ID',
          icon: <Copy size={17} aria-hidden="true" />,
          onSelect: () => {
            void copyText(contentId).then(() =>
              showToast({ title: 'Content ID copied', tone: 'success' }),
            );
          },
        },
      ]}
    />
  );
}
