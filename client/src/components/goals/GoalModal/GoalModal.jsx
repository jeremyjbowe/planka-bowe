/*!
 * DTP fork — GoalModal.
 *
 * Edit a goal (name, description, status, target date, parent, manual
 * progress) and manage its linked cards and boards. Editing is limited to the
 * owner and admins; everyone else gets a read-only view.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useClosableModal, usePopupInClosableContext } from '../../../hooks';
import { GoalStatuses, UserRoles } from '../../../constants/Enums';
import UserAvatar from '../../users/UserAvatar';
import ConfirmationStep from '../../common/ConfirmationStep';
import GoalProgressBar from '../GoalProgressBar';
import LinksSection from './LinksSection';

import styles from './GoalModal.module.scss';

const STATUS_LABEL_KEYS = {
  [GoalStatuses.ACTIVE]: 'common.goalStatusActive',
  [GoalStatuses.PAUSED]: 'common.goalStatusPaused',
  [GoalStatuses.DONE]: 'common.goalStatusDone',
};

const toDateInputValue = (date) => {
  if (!date) {
    return '';
  }

  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const GoalModal = React.memo(() => {
  const goal = useSelector(selectors.selectCurrentGoal);
  const goalOptions = useSelector(selectors.selectGoalOptions, shallowEqual);
  const currentUser = useSelector(selectors.selectCurrentUser);

  const selectGoalProgressById = useMemo(() => selectors.makeSelectGoalProgressById(), []);
  const progress = useSelector(
    (state) => (goal ? selectGoalProgressById(state, goal.id) : null),
    shallowEqual,
  );

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [ClosableModal] = useClosableModal();
  const ConfirmationPopup = usePopupInClosableContext(ConfirmationStep);

  const [nameDraft, setNameDraft] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState(null);

  const canEdit =
    !!goal &&
    !!currentUser &&
    (goal.ownerUserId === currentUser.id || currentUser.role === UserRoles.ADMIN);

  const handleClose = useCallback(() => {
    dispatch(entryActions.closeModal());
  }, [dispatch]);

  const update = useCallback(
    (data) => {
      dispatch(entryActions.updateGoal(goal.id, data));
    },
    [goal, dispatch],
  );

  const handleNameBlur = useCallback(() => {
    if (nameDraft !== null) {
      const cleanName = nameDraft.trim();

      if (cleanName && cleanName !== goal.name) {
        update({ name: cleanName });
      }

      setNameDraft(null);
    }
  }, [nameDraft, goal, update]);

  const handleDescriptionBlur = useCallback(() => {
    if (descriptionDraft !== null) {
      const cleanDescription = descriptionDraft.trim() || null;

      if (cleanDescription !== goal.description) {
        update({ description: cleanDescription });
      }

      setDescriptionDraft(null);
    }
  }, [descriptionDraft, goal, update]);

  const handleStatusChange = useCallback(
    (_, { value }) => {
      update({ status: value });
    },
    [update],
  );

  const handleTargetDateChange = useCallback(
    ({ target: { value } }) => {
      update({ targetDate: value ? new Date(`${value}T12:00:00`) : null });
    },
    [update],
  );

  const handleParentChange = useCallback(
    (_, { value }) => {
      update({ parentGoalId: value || null });
    },
    [update],
  );

  const handleProgressChange = useCallback(
    ({ target: { value } }) => {
      update({ progress: Number(value) });
    },
    [update],
  );

  const handleDeleteConfirm = useCallback(() => {
    dispatch(entryActions.deleteGoal(goal.id));
    dispatch(entryActions.closeModal());
  }, [goal, dispatch]);

  if (!goal) {
    return null;
  }

  // Exclude the goal itself and its descendants from the parent picker.
  const descendantIds = new Set();
  const collect = (id) => {
    descendantIds.add(id);
    goalOptions
      .filter((option) => option.parentGoalId === id)
      .forEach((option) => collect(option.id));
  };
  collect(goal.id);

  const parentOptions = [
    { key: 'none', value: '', text: t('common.noParentGoal') },
    ...goalOptions
      .filter((option) => !descendantIds.has(option.id))
      .map((option) => ({ key: option.id, value: option.id, text: option.name })),
  ];

  const statusOptions = Object.values(GoalStatuses).map((status) => ({
    key: status,
    value: status,
    text: t(STATUS_LABEL_KEYS[status]),
  }));

  return (
    <ClosableModal closeIcon size="small" centered={false} onClose={handleClose}>
      <ClosableModal.Content className={styles.content}>
        <div className={styles.eyebrow}>
          <Icon name="bullseye" className={styles.eyebrowIcon} />
          {t('common.goal')}
          {goal.ownerUserId && (
            <span className={styles.owner}>
              <UserAvatar id={goal.ownerUserId} size="tiny" />
            </span>
          )}
        </div>
        {canEdit ? (
          <input
            value={nameDraft === null ? goal.name : nameDraft}
            maxLength={256}
            className={styles.nameInput}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(event) => event.key === 'Enter' && event.target.blur()}
          />
        ) : (
          <h2 className={styles.name}>{goal.name}</h2>
        )}

        <div className={styles.progressBlock}>
          <GoalProgressBar percent={progress.percent} size="large" />
          <div className={styles.progressHint}>
            {progress.isManual
              ? t('common.noLinksYet')
              : t('common.progressFromLinks', { count: progress.itemsTotal })}
          </div>
          {progress.isManual && canEdit && goal.status !== GoalStatuses.DONE && (
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={goal.progress || 0}
              className={styles.range}
              aria-label={t('common.manualProgress')}
              onChange={handleProgressChange}
            />
          )}
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <div className={styles.label}>{t('common.goalStatus')}</div>
            <Dropdown
              selection
              fluid
              disabled={!canEdit}
              value={goal.status}
              options={statusOptions}
              onChange={handleStatusChange}
            />
          </div>
          <div className={styles.field}>
            <div className={styles.label}>{t('common.targetDate')}</div>
            <input
              type="date"
              disabled={!canEdit}
              value={toDateInputValue(goal.targetDate)}
              className={styles.dateInput}
              onChange={handleTargetDateChange}
            />
          </div>
          <div className={styles.field}>
            <div className={styles.label}>{t('common.parentGoal')}</div>
            <Dropdown
              selection
              fluid
              search
              disabled={!canEdit}
              value={goal.parentGoalId || ''}
              placeholder={t('common.noParentGoal')}
              options={parentOptions}
              onChange={handleParentChange}
            />
          </div>
        </div>

        <div className={styles.label}>{t('common.description')}</div>
        {canEdit ? (
          <textarea
            value={descriptionDraft === null ? goal.description || '' : descriptionDraft}
            placeholder={t('common.noDescription')}
            maxLength={4096}
            rows={3}
            className={styles.textarea}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onBlur={handleDescriptionBlur}
          />
        ) : (
          <p className={styles.description}>{goal.description || t('common.noDescription')}</p>
        )}

        <LinksSection goalId={goal.id} canEdit={canEdit} />

        {canEdit && (
          <div className={styles.footer}>
            <ConfirmationPopup
              title="common.deleteGoal"
              content="common.areYouSureYouWantToDeleteThisGoal"
              buttonContent="action.deleteGoal"
              onConfirm={handleDeleteConfirm}
            >
              <Button type="button" className={styles.deleteButton}>
                <Icon name="trash alternate outline" />
                {t('common.deleteGoal')}
              </Button>
            </ConfirmationPopup>
          </div>
        )}
      </ClosableModal.Content>
    </ClosableModal>
  );
});

export default GoalModal;
