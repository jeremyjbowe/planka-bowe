/*!
 * DTP fork — one subtask row inside the card modal.
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Checkbox, Icon } from 'semantic-ui-react';
import { push } from '../../../../lib/redux-router';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import Paths from '../../../../constants/Paths';
import UserAvatar from '../../../users/UserAvatar';
import DueDateChip from '../../DueDateChip';

import styles from './Item.module.scss';

const Item = React.memo(({ id, canEdit }) => {
  const selectCardById = useMemo(() => selectors.makeSelectCardById(), []);
  const selectListById = useMemo(() => selectors.makeSelectListById(), []);
  const selectUserIdsByCardId = useMemo(() => selectors.makeSelectUserIdsByCardId(), []);

  const card = useSelector((state) => selectCardById(state, id));
  const list = useSelector((state) => selectListById(state, card.listId));
  const userIds = useSelector((state) => selectUserIdsByCardId(state, id));

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleToggleChange = useCallback(() => {
    dispatch(
      entryActions.updateCard(id, {
        isClosed: !card.isClosed,
      }),
    );
  }, [id, card.isClosed, dispatch]);

  const handleNameClick = useCallback(() => {
    dispatch(push(Paths.CARDS.replace(':id', id)));
  }, [id, dispatch]);

  const handleUnlinkClick = useCallback(() => {
    dispatch(
      entryActions.updateCard(id, {
        parentCardId: null,
      }),
    );
  }, [id, dispatch]);

  return (
    <div className={classNames(styles.wrapper, card.isClosed && styles.wrapperClosed)}>
      <Checkbox
        checked={card.isClosed}
        disabled={!canEdit || !card.isPersisted}
        className={styles.checkbox}
        onChange={handleToggleChange}
      />
      <button type="button" className={styles.name} onClick={handleNameClick}>
        {card.name}
      </button>
      {list && list.name && <span className={styles.list}>{list.name}</span>}
      {card.dueDate && (
        <span className={styles.dueDate}>
          <DueDateChip
            value={card.dueDate}
            size="tiny"
            isCompleted={card.isDueCompleted}
            withStatus={!card.isClosed}
          />
        </span>
      )}
      {userIds.length > 0 && (
        <span className={styles.users}>
          {userIds.map((userId) => (
            <UserAvatar key={userId} id={userId} size="tiny" />
          ))}
        </span>
      )}
      {canEdit && (
        <button
          type="button"
          title={t('common.unlinkSubtask')}
          className={styles.unlink}
          onClick={handleUnlinkClick}
        >
          <Icon fitted name="unlink" size="small" />
        </button>
      )}
    </div>
  );
});

Item.propTypes = {
  id: PropTypes.string.isRequired,
  canEdit: PropTypes.bool.isRequired,
};

export default Item;
