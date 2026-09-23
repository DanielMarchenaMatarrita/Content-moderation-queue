import { Bell, CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';
import { useActivity } from '../providers/ActivityProvider';
import { Sheet } from '../../shared/components/Modal';
import { IconButton } from '../../shared/components/IconButton';
import { Button } from '../../shared/components/Button';
import { formatDateTime } from '../../shared/lib/format';

interface ActivityCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityCenter({ open, onOpenChange }: ActivityCenterProps) {
  const { activities, clearActivities } = useActivity();

  return (
    <>
      <div className="activity-trigger-wrap">
        <IconButton label="Open session activity" onClick={() => onOpenChange(true)}>
          <Bell size={19} aria-hidden="true" />
        </IconButton>
        {activities.length ? (
          <span className="activity-count" aria-label={`${activities.length} session activities`}>
            {Math.min(activities.length, 9)}
          </span>
        ) : null}
      </div>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="Session activity"
        description="Events observed in this browser session only."
      >
        <div className="activity-panel">
          {activities.length ? (
            <>
              <div className="activity-list">
                {activities.map((activity) => {
                  const Icon =
                    activity.tone === 'success'
                      ? CheckCircle
                      : activity.tone === 'error'
                        ? WarningCircle
                        : Info;
                  return (
                    <article key={activity.id} className="activity-item">
                      <Icon
                        size={19}
                        weight="fill"
                        className={`activity-icon activity-${activity.tone}`}
                        aria-hidden="true"
                      />
                      <div>
                        <h3>{activity.title}</h3>
                        <p>{activity.description}</p>
                        <time dateTime={activity.occurredAt}>
                          {formatDateTime(activity.occurredAt)}
                        </time>
                      </div>
                    </article>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" onClick={clearActivities}>
                Clear session activity
              </Button>
            </>
          ) : (
            <div className="empty-compact">
              <Bell size={24} aria-hidden="true" />
              <h3>No session activity</h3>
              <p>Submissions, observed transitions, and creations appear here.</p>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
