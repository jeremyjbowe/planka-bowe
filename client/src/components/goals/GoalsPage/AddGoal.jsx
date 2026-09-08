/*!
 * DTP fork — inline "add goal" form on the Goals page.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';

import styles from './GoalsPage.module.scss';

const AddGoal = React.memo(({ onCreate, onClose }) => {
  const [t] = useTranslation();
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current.focus();
  }, []);

  const submit = useCallback(() => {
    const cleanName = name.trim();

    if (!cleanName) {
      nameRef.current.focus();
      return;
    }

    onCreate({
      name: cleanName,
      ...(targetDate && { targetDate: new Date(`${targetDate}T12:00:00`) }),
    });

    onClose();
  }, [name, targetDate, onCreate, onClose]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      } else if (event.key === 'Escape') {
        onClose();
      }
    },
    [submit, onClose],
  );

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      <input
        ref={nameRef}
        value={name}
        placeholder={t('common.goalNamePlaceholder')}
        maxLength={256}
        className={styles.addInput}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        type="date"
        value={targetDate}
        title={t('common.targetDate')}
        className={styles.addDate}
        onChange={(event) => setTargetDate(event.target.value)}
      />
      <Button positive type="submit" content={t('action.createGoal')} />
      <Button type="button" basic content={t('action.cancel')} onClick={onClose} />
    </form>
  );
});

AddGoal.propTypes = {
  onCreate: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AddGoal;
