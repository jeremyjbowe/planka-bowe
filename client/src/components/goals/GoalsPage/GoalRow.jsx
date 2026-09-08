/*!
 * DTP fork — one goal in the tree, recursively rendering its sub-goals.
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { GoalStatuses } from '../../../constants/Enums';
import UserAvatar from '../../users/UserAvatar';
import GoalProgressBar from '../GoalProgressBar';

import styles from './GoalsPage.module.scss';

const GoalRow = React.memo(({ goal, depth, onOpen }) => {
  const [t] = useTranslation();

  const handleClick = useCallback(() => {
    onOpen(goal.id);
  }, [goal.id, onOpen]);

  const isOverdue =
    goal.targetDate && goal.status !== GoalStatuses.DONE && goal.targetDate < new Date();

  return (
    <>
      <button
        type="button"
        className={classNames(styles.row, !goal.isPersisted && styles.rowPending)}
        style={{ marginLeft: depth * 28 }}
        disabled={!goal.isPersisted}
        onClick={handleClick}
      >
        <div className={styles.rowMain}>
          <span className={styles.rowIconWrapper}>
            <Icon name={depth > 0 ? 'level up alternate' : 'bullseye'} className={styles.rowIcon} />
          </span>
          <span className={styles.rowName}>{goal.name}</span>
          {goal.targetDate && (
            <span className={classNames(styles.rowDate, isOverdue && styles.rowDateOverdue)}>
              <Icon name="calendar check outline" />
              {t('format:longDate', {
                postProcess: 'formatDate',
                value: goal.targetDate,
              })}
            </span>
          )}
          {goal.linksTotal > 0 && (
            <span className={styles.rowMeta}>
              <Icon name="linkify" />
              {goal.linksTotal}
            </span>
          )}
          {goal.children.length > 0 && (
            <span className={styles.rowMeta}>
              <Icon name="sitemap" />
              {goal.children.length}
            </span>
          )}
          {goal.ownerUserId && (
            <span className={styles.rowOwner}>
              <UserAvatar id={goal.ownerUserId} size="tiny" />
            </span>
          )}
        </div>
        <div className={styles.rowProgress}>
          <GoalProgressBar percent={goal.progress.percent} size="medium" />
          {goal.progress.isManual && (
            <span className={styles.rowManual}>{t('common.manualProgress')}</span>
          )}
        </div>
      </button>
      {goal.children.map((child) => (
        <GoalRow key={child.id} goal={child} depth={depth + 1} onOpen={onOpen} />
      ))}
    </>
  );
});

GoalRow.propTypes = {
  goal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    targetDate: PropTypes.instanceOf(Date),
    ownerUserId: PropTypes.string,
    isPersisted: PropTypes.bool,
    linksTotal: PropTypes.number,
    progress: PropTypes.shape({
      percent: PropTypes.number.isRequired,
      isManual: PropTypes.bool.isRequired,
    }).isRequired,
    children: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
  depth: PropTypes.number.isRequired,
  onOpen: PropTypes.func.isRequired,
};

export default GoalRow;
