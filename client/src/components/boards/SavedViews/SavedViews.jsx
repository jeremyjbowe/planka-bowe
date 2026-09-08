/*!
 * DTP fork — the "Views" button at the left of the board actions row.
 */

import React from 'react';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import { usePopup } from '../../../lib/popup';

import selectors from '../../../selectors';
import SavedViewsStep from './SavedViewsStep';

import styles from './SavedViews.module.scss';

const SavedViews = React.memo(() => {
  const activeSavedViewId = useSelector(selectors.selectActiveSavedViewIdForCurrentBoard);
  const activeSavedView = useSelector((state) =>
    activeSavedViewId ? selectors.selectSavedViewById(state, activeSavedViewId) : null,
  );

  const [t] = useTranslation();

  const SavedViewsPopup = usePopup(SavedViewsStep);

  return (
    <SavedViewsPopup>
      <button
        type="button"
        className={classNames(styles.button, activeSavedView && styles.buttonActive)}
      >
        <Icon fitted name="bookmark outline" className={styles.icon} />
        <span className={styles.name}>
          {activeSavedView ? activeSavedView.name : t('common.views')}
        </span>
        <Icon fitted name="dropdown" className={styles.caret} />
      </button>
    </SavedViewsPopup>
  );
});

export default SavedViews;
