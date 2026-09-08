/*!
 * DTP fork — breadcrumb shown above a subtask's title, linking to its parent.
 */

import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import { push } from '../../../../lib/redux-router';

import selectors from '../../../../selectors';
import Paths from '../../../../constants/Paths';

import styles from './ParentCrumb.module.scss';

const ParentCrumb = React.memo(() => {
  const parentCard = useSelector(selectors.selectParentCardForCurrentCard);
  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleClick = useCallback(() => {
    dispatch(push(Paths.CARDS.replace(':id', parentCard.id)));
  }, [parentCard, dispatch]);

  if (!parentCard) {
    return null;
  }

  return (
    <button type="button" className={styles.crumb} onClick={handleClick}>
      <Icon name="level up alternate" className={styles.icon} />
      <span className={styles.label}>{t('common.parentCard')}</span>
      <span className={styles.name}>{parentCard.name}</span>
    </button>
  );
});

export default ParentCrumb;
