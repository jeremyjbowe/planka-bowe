/*!
 * DTP fork — Subtasks section of the card modal.
 *
 * Lists the child cards of the current card with a live progress bar, lets
 * editors add a child inline (a real card created in the parent's list) or
 * link an existing card of the board as a child.
 */

import React, { useCallback, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import { usePopupInClosableContext } from '../../../../hooks';
import { BoardMembershipRoles } from '../../../../constants/Enums';
import SelectCardStep from '../../SelectCardStep';
import Item from './Item';
import AddSubtask from './AddSubtask';

import styles from './Subtasks.module.scss';

const Subtasks = React.memo(() => {
  const card = useSelector(selectors.selectCurrentCard);
  const board = useSelector(selectors.selectCurrentBoard);
  const subtaskIds = useSelector(selectors.selectSubtaskIdsForCurrentCard, shallowEqual);
  const descendantIds = useSelector(
    selectors.selectDescendantIdsWithSelfForCurrentCard,
    shallowEqual,
  );

  const { total, completed } = useSelector(
    selectors.selectSubtaskProgressForCurrentCard,
    shallowEqual,
  );

  const canEdit = useSelector((state) => {
    const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);
    return !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;
  });

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [isAddOpened, setIsAddOpened] = useState(false);

  const handleAddClick = useCallback(() => {
    setIsAddOpened(true);
  }, []);

  const handleAddClose = useCallback(() => {
    setIsAddOpened(false);
  }, []);

  const handleCreate = useCallback(
    (name) => {
      dispatch(
        entryActions.createCard(card.listId, {
          name,
          type: board.defaultCardType,
          parentCardId: card.id,
        }),
      );
    },
    [card.id, card.listId, board.defaultCardType, dispatch],
  );

  const handleLinkSelect = useCallback(
    (cardId) => {
      dispatch(
        entryActions.updateCard(cardId, {
          parentCardId: card.id,
        }),
      );
    },
    [card.id, dispatch],
  );

  const LinkCardPopup = usePopupInClosableContext(SelectCardStep);

  if (subtaskIds.length === 0 && !canEdit) {
    return null;
  }

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={styles.contentModule}>
      <div className={styles.moduleWrapper}>
        <Icon name="sitemap" className={styles.moduleIcon} />
        <div className={styles.header}>
          <div className={styles.moduleHeader}>{t('common.subtasks')}</div>
          {total > 0 && (
            <span className={styles.summary}>
              {t('common.subtasksDone', {
                completed,
                total,
              })}
            </span>
          )}
        </div>
        {total > 0 && (
          <div
            className={styles.progress}
            role="progressbar"
            aria-label={t('common.subtasks')}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completed}
          >
            <div
              className={percent === 100 ? styles.progressBarComplete : styles.progressBar}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {subtaskIds.length > 0 && (
          <div className={styles.items}>
            {subtaskIds.map((subtaskId) => (
              <Item key={subtaskId} id={subtaskId} canEdit={canEdit} />
            ))}
          </div>
        )}
        {canEdit && (
          <div className={styles.footer}>
            {isAddOpened ? (
              <AddSubtask onCreate={handleCreate} onClose={handleAddClose} />
            ) : (
              <>
                <Button type="button" className={styles.footerButton} onClick={handleAddClick}>
                  <Icon name="plus" className={styles.footerButtonIcon} />
                  {t('common.addSubtask')}
                </Button>
                <LinkCardPopup
                  title={t('common.linkExistingCard')}
                  excludedIds={descendantIds}
                  onSelect={handleLinkSelect}
                >
                  <Button type="button" className={styles.footerButton}>
                    <Icon name="linkify" className={styles.footerButtonIcon} />
                    {t('common.linkExistingCard')}
                  </Button>
                </LinkCardPopup>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default Subtasks;
