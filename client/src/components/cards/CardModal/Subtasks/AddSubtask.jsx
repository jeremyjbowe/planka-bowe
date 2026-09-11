/*!
 * planka-bowe — inline "add subtask" input. Enter creates and keeps the field
 * open for rapid entry; Escape or an empty submit closes it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Form } from 'semantic-ui-react';

import styles from './AddSubtask.module.scss';

const AddSubtask = React.memo(({ onCreate, onClose }) => {
  const [t] = useTranslation();
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  const handleChange = useCallback(({ target: { value } }) => {
    setName(value);
  }, []);

  const handleSubmit = useCallback(() => {
    const cleanName = name.trim();

    if (!cleanName) {
      onClose();
      return;
    }

    onCreate(cleanName);
    setName('');
    inputRef.current.focus();
  }, [name, onCreate, onClose]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        // Submit explicitly; the modal intercepts native form submission.
        event.preventDefault();
        handleSubmit();
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  return (
    <Form className={styles.form} onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        value={name}
        placeholder={t('common.subtaskNamePlaceholder')}
        maxLength={1024}
        className={styles.input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className={styles.controls}>
        <Button positive type="submit" size="small" content={t('common.addSubtask')} />
        <Button type="button" basic size="small" content={t('action.cancel')} onClick={onClose} />
      </div>
    </Form>
  );
});

AddSubtask.propTypes = {
  onCreate: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AddSubtask;
