/*!
 * planka-bowe — EditColorStep.
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
import { CardColors } from '../../../constants/Enums';

import styles from './EditColorStep.module.scss';

const EditColorStep = React.memo(({ cardId, onBack, onClose }) => {
  const selectCardById = useMemo(() => selectors.makeSelectCardById(), []);
  const currentValue = useSelector((state) => selectCardById(state, cardId).color);

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleSelect = useCallback(
    (color) => {
      if (color !== currentValue) {
        dispatch(entryActions.updateCard(cardId, { color }));
      }

      onClose();
    },
    [cardId, currentValue, dispatch, onClose],
  );

  return (
    <>
      <Popup.Header onBack={onBack}>
        {t('common.editColor', {
          context: 'title',
        })}
      </Popup.Header>
      <Popup.Content>
        <div className={styles.swatches}>
          {CardColors.map((color) => (
            <button
              key={color}
              type="button"
              title={t(`common.color_${color}`)}
              className={classNames(
                styles.swatch,
                styles[`swatch_${color}`],
                color === currentValue && styles.swatchActive,
              )}
              onClick={() => handleSelect(color)}
            >
              {color === currentValue && <Icon name="check" className={styles.check} />}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={classNames(styles.noColor, !currentValue && styles.noColorActive)}
          onClick={() => handleSelect(null)}
        >
          <span>{t('common.noColor')}</span>
          {!currentValue && <Icon name="check" className={styles.check} />}
        </button>
      </Popup.Content>
    </>
  );
});

EditColorStep.propTypes = {
  cardId: PropTypes.string.isRequired,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

EditColorStep.defaultProps = {
  onBack: undefined,
};

export default EditColorStep;
