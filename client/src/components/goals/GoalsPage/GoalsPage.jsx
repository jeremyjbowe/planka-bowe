/*!
 * DTP fork — GoalsPage.
 *
 * Lists every goal as a tree grouped by status, with live progress bars.
 * Admins and project owners can add goals inline; anyone can open a goal.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { GoalStatuses } from '../../../constants/Enums';
import EmptyState from '../../common/EmptyState';
import GoalRow from './GoalRow';
import AddGoal from './AddGoal';

import styles from './GoalsPage.module.scss';

const STATUS_ORDER = [GoalStatuses.ACTIVE, GoalStatuses.PAUSED, GoalStatuses.DONE];

const STATUS_LABEL_KEYS = {
  [GoalStatuses.ACTIVE]: 'common.goalStatusActive',
  [GoalStatuses.PAUSED]: 'common.goalStatusPaused',
  [GoalStatuses.DONE]: 'common.goalStatusDone',
};

const GoalsPage = React.memo(() => {
  const tree = useSelector(selectors.selectGoalTree);
  const canManage = useSelector(selectors.selectCanCurrentUserManageGoals);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [isAddOpened, setIsAddOpened] = useState(false);

  const groups = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        goals: tree.filter((goal) => goal.status === status),
      })).filter((group) => group.goals.length > 0),
    [tree],
  );

  const handleAddClick = useCallback(() => {
    setIsAddOpened(true);
  }, []);

  const handleAddClose = useCallback(() => {
    setIsAddOpened(false);
  }, []);

  const handleCreate = useCallback(
    (data) => {
      dispatch(entryActions.createGoal(data));
    },
    [dispatch],
  );

  const handleOpen = useCallback(
    (id) => {
      dispatch(entryActions.openGoalModal(id));
    },
    [dispatch],
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Icon name="bullseye" className={styles.titleIcon} />
            {t('common.goals')}
          </h1>
          <p className={styles.subtitle}>{t('common.goalsSubtitle')}</p>
        </div>
        {canManage && !isAddOpened && (
          <Button positive className={styles.addButton} onClick={handleAddClick}>
            <Icon name="plus" />
            {t('common.addGoal')}
          </Button>
        )}
      </div>
      {isAddOpened && <AddGoal onCreate={handleCreate} onClose={handleAddClose} />}
      {tree.length === 0 && !isAddOpened ? (
        <EmptyState
          size="large"
          icon="bullseye"
          title={t('common.noGoalsYet')}
          hint={canManage ? t('common.noGoalsHintOwner') : t('common.noGoalsHintMember')}
        >
          {canManage && (
            <Button positive size="large" onClick={handleAddClick}>
              <Icon name="plus" />
              {t('common.addGoal')}
            </Button>
          )}
        </EmptyState>
      ) : (
        groups.map((group) => (
          <section key={group.status} className={styles.group}>
            <h2 className={styles.groupTitle}>
              {t(STATUS_LABEL_KEYS[group.status])}
              <span className={styles.groupCount}>{group.goals.length}</span>
            </h2>
            <div className={styles.list}>
              {group.goals.map((goal) => (
                <GoalRow key={goal.id} goal={goal} depth={0} onOpen={handleOpen} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
});

export default GoalsPage;
