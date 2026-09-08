/*!
 * DTP fork — EditPriorityStep.
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import { Popup } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { CardPriorities } from '../../../constants/Enums';
import PriorityChip from '../PriorityChip';

import styles from './EditPriorityStep.module.scss';

const EditPriorityStep = React.memo(({ cardId, onBack, onClose }) => {
  const selectCardById = useMemo(() => selectors.makeSelectCardById(), []);
  const currentValue = useSelector((state) => selectCardById(state, cardId).priority);

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleSelect = useCallback(
    (priority) => {
      if (priority !== currentValue) {
        dispatch(entryActions.updateCard(cardId, { priority }));
      }

      onClose();
    },
    [cardId, currentValue, dispatch, onClose],
  );

  return (
    <>
      <Popup.Header onBack={onBack}>
        {t('common.editPriority', {
          context: 'title',
        })}
      </Popup.Header>
      <Popup.Content>
        <div className={styles.items}>
          {[
            CardPriorities.URGENT,
            CardPriorities.HIGH,
            CardPriorities.MEDIUM,
            CardPriorities.LOW,
          ].map((priority) => (
            <button
              key={priority}
              type="button"
              className={classNames(styles.item, priority === currentValue && styles.itemActive)}
              onClick={() => handleSelect(priority)}
            >
              <PriorityChip value={priority} size="small" />
              {priority === currentValue && <Icon name="check" className={styles.check} />}
            </button>
          ))}
          <button
            type="button"
            className={classNames(styles.item, !currentValue && styles.itemActive)}
            onClick={() => handleSelect(null)}
          >
            <span className={styles.none}>{t('common.noPriority')}</span>
            {!currentValue && <Icon name="check" className={styles.check} />}
          </button>
        </div>
      </Popup.Content>
    </>
  );
});

EditPriorityStep.propTypes = {
  cardId: PropTypes.string.isRequired,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

EditPriorityStep.defaultProps = {
  onBack: undefined,
};

export default EditPriorityStep;
