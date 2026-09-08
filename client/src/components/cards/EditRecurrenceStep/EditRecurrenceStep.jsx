/*!
 * DTP fork — EditRecurrenceStep.
 *
 * Presets for the common cadences plus a free-form RRULE field with a live
 * human-readable preview. Saving dispatches the ordinary updateCard entry
 * action; the server creates the next occurrence when the card is completed.
 */

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Form, Icon } from 'semantic-ui-react';
import { Input, Popup } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import {
  RECURRENCE_PRESETS,
  describeRecurrence,
  isValidRecurrenceRule,
  normalizeRecurrenceRule,
} from '../../../utils/recurrence';

import styles from './EditRecurrenceStep.module.scss';

const EditRecurrenceStep = React.memo(({ cardId, onBack, onClose }) => {
  const selectCardById = useMemo(() => selectors.makeSelectCardById(), []);
  const defaultValue = useSelector((state) => selectCardById(state, cardId).recurrenceRule);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [value, setValue] = useState(defaultValue || '');

  const normalizedValue = useMemo(() => normalizeRecurrenceRule(value), [value]);
  const isValid = useMemo(() => isValidRecurrenceRule(normalizedValue), [normalizedValue]);

  const activePreset = useMemo(
    () => RECURRENCE_PRESETS.find((preset) => preset.rule === normalizedValue),
    [normalizedValue],
  );

  let previewText = t('common.recurrenceNone');
  if (value) {
    previewText = isValid ? describeRecurrence(normalizedValue) : t('common.recurrenceInvalid');
  }

  const handlePresetClick = useCallback(({ currentTarget: { value: rule } }) => {
    setValue(rule);
  }, []);

  const handleChange = useCallback(({ target: { value: nextValue } }) => {
    setValue(nextValue);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!normalizedValue) {
      if (defaultValue) {
        dispatch(entryActions.updateCard(cardId, { recurrenceRule: null }));
      }

      onClose();
      return;
    }

    if (!isValid) {
      return;
    }

    if (normalizedValue !== defaultValue) {
      dispatch(entryActions.updateCard(cardId, { recurrenceRule: normalizedValue }));
    }

    onClose();
  }, [cardId, defaultValue, normalizedValue, isValid, dispatch, onClose]);

  const handleClearClick = useCallback(() => {
    if (defaultValue) {
      dispatch(entryActions.updateCard(cardId, { recurrenceRule: null }));
    }

    onClose();
  }, [cardId, defaultValue, dispatch, onClose]);

  return (
    <>
      <Popup.Header onBack={onBack}>
        {t('common.editRecurrence', {
          context: 'title',
        })}
      </Popup.Header>
      <Popup.Content>
        <Form onSubmit={handleSubmit}>
          <div className={styles.presets}>
            {RECURRENCE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                value={preset.rule}
                className={classNames(
                  styles.preset,
                  activePreset && activePreset.key === preset.key && styles.presetActive,
                )}
                onClick={handlePresetClick}
              >
                {t(preset.labelKey)}
              </button>
            ))}
          </div>
          <div className={styles.text}>{t('common.recurrenceCustom')}</div>
          <Input
            fluid
            value={value}
            placeholder="FREQ=WEEKLY;BYDAY=MO,WE"
            maxLength={512}
            className={styles.input}
            onChange={handleChange}
          />
          <div className={classNames(styles.preview, !isValid && value && styles.previewInvalid)}>
            <Icon
              name={isValid ? 'sync alternate' : 'warning circle'}
              className={styles.previewIcon}
            />
            {previewText}
          </div>
          <p className={styles.hint}>{t('common.recurrenceNextOccurrenceHint')}</p>
          <div className={styles.controls}>
            <Button positive content={t('action.save')} disabled={!!value && !isValid} />
            {defaultValue && (
              <Button
                type="button"
                content={t('action.remove')}
                className={styles.clearButton}
                onClick={handleClearClick}
              />
            )}
          </div>
        </Form>
      </Popup.Content>
    </>
  );
});

EditRecurrenceStep.propTypes = {
  cardId: PropTypes.string.isRequired,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

EditRecurrenceStep.defaultProps = {
  onBack: undefined,
};

export default EditRecurrenceStep;
