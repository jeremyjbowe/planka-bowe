/*!
 * DTP fork — "2/5" progress line on the face of a card that has subtasks.
 * Reads the children straight from the ORM, so it animates as soon as a
 * child card is completed anywhere.
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useSelector } from 'react-redux';
import { Icon } from 'semantic-ui-react';

import selectors from '../../../../selectors';

import styles from './SubtasksProgress.module.scss';

const SubtasksProgress = React.memo(({ cardId }) => {
  const selectSubtaskProgressByCardId = useMemo(
    () => selectors.makeSelectSubtaskProgressByCardId(),
    [],
  );

  const { total, completed } = useSelector(
    (state) => selectSubtaskProgressByCardId(state, cardId),
    shallowEqual,
  );

  if (total === 0) {
    return null;
  }

  const percent = Math.round((completed / total) * 100);

  return (
    <div className={styles.wrapper} title={`${completed}/${total}`}>
      <Icon name="sitemap" className={styles.icon} />
      <span className={styles.track}>
        <span
          className={percent === 100 ? styles.barComplete : styles.bar}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className={styles.count}>
        {completed}/{total}
      </span>
    </div>
  );
});

SubtasksProgress.propTypes = {
  cardId: PropTypes.string.isRequired,
};

export default SubtasksProgress;
