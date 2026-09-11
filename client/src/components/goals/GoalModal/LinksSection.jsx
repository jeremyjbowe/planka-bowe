/*!
 * planka-bowe — linked cards and boards of a goal, with add/remove.
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';
import { push } from '../../../lib/redux-router';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import Paths from '../../../constants/Paths';
import { usePopupInClosableContext } from '../../../hooks';
import AddLinkStep from './AddLinkStep';

import styles from './GoalModal.module.scss';

const getLinkIconName = (link) => {
  if (link.type !== 'card') {
    return 'columns';
  }

  return link.isClosed ? 'check circle' : 'circle outline';
};

const LinksSection = React.memo(({ goalId, canEdit }) => {
  const selectGoalLinksByGoalId = useMemo(() => selectors.makeSelectGoalLinksByGoalId(), []);
  const links = useSelector((state) => selectGoalLinksByGoalId(state, goalId), shallowEqual);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const AddLinkPopup = usePopupInClosableContext(AddLinkStep);

  const handleOpen = useCallback(
    (link) => {
      dispatch(entryActions.closeModal());
      dispatch(
        push(
          link.type === 'card'
            ? Paths.CARDS.replace(':id', link.targetId)
            : Paths.BOARDS.replace(':id', link.targetId),
        ),
      );
    },
    [dispatch],
  );

  const handleRemove = useCallback(
    (id) => {
      dispatch(entryActions.deleteGoalLink(id));
    },
    [dispatch],
  );

  return (
    <div className={styles.links}>
      <div className={styles.linksHeader}>
        <div className={styles.label}>{t('common.linkedWork')}</div>
        {canEdit && (
          <AddLinkPopup goalId={goalId}>
            <Button type="button" size="mini" className={styles.linkButton}>
              <Icon name="plus" />
              {t('action.linkToGoal')}
            </Button>
          </AddLinkPopup>
        )}
      </div>
      {links.length === 0 ? (
        <div className={styles.linksEmpty}>{t('common.noLinksYet')}</div>
      ) : (
        <div className={styles.linkList}>
          {links.map((link) => (
            <div
              key={link.id}
              className={classNames(styles.link, !link.isPersisted && styles.linkPending)}
            >
              <Icon
                name={getLinkIconName(link)}
                className={classNames(
                  styles.linkIcon,
                  link.type === 'card' && link.isClosed && styles.linkIconDone,
                )}
              />
              {link.isHidden ? (
                <span className={styles.linkNameHidden}>{t('common.hiddenLinkedItem')}</span>
              ) : (
                <button
                  type="button"
                  className={classNames(
                    styles.linkName,
                    link.type === 'card' && link.isClosed && styles.linkNameDone,
                  )}
                  onClick={() => handleOpen(link)}
                >
                  {link.name}
                </button>
              )}
              {link.type === 'board' && !link.isHidden && (
                <span className={styles.linkMeta}>
                  {t('common.goalLinkedCardsDone', {
                    done: link.closedCardsTotal,
                    total: link.cardsTotal,
                  })}
                </span>
              )}
              {canEdit && (
                <button
                  type="button"
                  title={t('action.remove')}
                  className={styles.linkRemove}
                  onClick={() => handleRemove(link.id)}
                >
                  <Icon fitted name="unlink" size="small" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

LinksSection.propTypes = {
  goalId: PropTypes.string.isRequired,
  canEdit: PropTypes.bool.isRequired,
};

export default LinksSection;
