/*!
 * DTP fork — name + "share with the board" form, used to save a new view
 * and to rename an existing one.
 */

import React, { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Form } from 'semantic-ui-react';
import { Input, Popup } from '../../../lib/custom-ui';

import { useForm, useNestedRef } from '../../../hooks';

import styles from './SavedViewFormStep.module.scss';

const SavedViewFormStep = React.memo(
  ({ title, buttonContent, defaultData, onSubmit, onBack, onClose }) => {
    const [t] = useTranslation();

    const [data, handleFieldChange] = useForm(() => ({
      name: '',
      isShared: false,
      ...defaultData,
    }));

    const [nameFieldRef, handleNameFieldRef] = useNestedRef('inputRef');

    useEffect(() => {
      nameFieldRef.current.focus({ preventScroll: true });
    }, [nameFieldRef]);

    const handleSubmit = useCallback(() => {
      const cleanData = {
        ...data,
        name: data.name.trim(),
      };

      if (!cleanData.name) {
        nameFieldRef.current.select();
        return;
      }

      onSubmit(cleanData);
      onClose();
    }, [data, nameFieldRef, onSubmit, onClose]);

    return (
      <>
        <Popup.Header onBack={onBack}>{t(title)}</Popup.Header>
        <Popup.Content>
          <Form onSubmit={handleSubmit}>
            <Input
              fluid
              ref={handleNameFieldRef}
              name="name"
              value={data.name}
              maxLength={128}
              placeholder={t('common.viewName')}
              className={styles.field}
              onChange={handleFieldChange}
            />
            <Checkbox
              name="isShared"
              checked={data.isShared}
              label={t('common.shareWithTheBoard')}
              className={styles.checkbox}
              onChange={handleFieldChange}
            />
            <Button positive content={t(buttonContent)} className={styles.submitButton} />
          </Form>
        </Popup.Content>
      </>
    );
  },
);

SavedViewFormStep.propTypes = {
  title: PropTypes.string.isRequired,
  buttonContent: PropTypes.string.isRequired,
  /* eslint-disable react/forbid-prop-types */
  defaultData: PropTypes.object,
  /* eslint-enable react/forbid-prop-types */
  onSubmit: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

SavedViewFormStep.defaultProps = {
  defaultData: undefined,
  onBack: undefined,
};

export default SavedViewFormStep;
