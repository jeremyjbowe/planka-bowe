/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';
import { FilePicker, Popup } from '../../../lib/custom-ui';

import { BoardImportTypes } from '../../../constants/Enums';

import styles from './ImportStep.module.scss';

const ImportStep = React.memo(({ onSelect, onBack }) => {
  const [t] = useTranslation();

  const handleFileSelect = useCallback(
    (type, file) => {
      onSelect({
        type,
        file,
      });

      onBack();
    },
    [onSelect, onBack],
  );

  return (
    <>
      <Popup.Header onBack={onBack}>
        {t('common.importBoard', {
          context: 'title',
        })}
      </Popup.Header>
      <Popup.Content>
        <FilePicker
          accept=".json"
          onSelect={(file) => handleFileSelect(BoardImportTypes.TRELLO, file)}
        >
          <Button fluid content={t('common.fromTrello')} icon="trello" className={styles.button} />
        </FilePicker>
        {/* DTP fork — a board exported by this app */}
        <FilePicker
          accept=".json"
          onSelect={(file) => handleFileSelect(BoardImportTypes.PLANKA_JSON, file)}
        >
          <Button
            fluid
            content={t('common.fromPlankaJson')}
            icon="download"
            className={styles.button}
          />
        </FilePicker>
      </Popup.Content>
    </>
  );
});

ImportStep.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default ImportStep;
