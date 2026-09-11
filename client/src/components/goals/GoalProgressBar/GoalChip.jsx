/*!
 * planka-bowe — GoalChip. Small pill naming a goal with its progress, used in
 * the card modal. Click opens the goal.
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';

import styles from './GoalChip.module.scss';

const GoalChip = React.memo(({ id }) => {
  const selectGoalById = useMemo(() => selectors.makeSelectGoalById(), []);
  const selectGoalProgressById = useMemo(() => selectors.makeSelectGoalProgressById(), []);

  const goal = useSelector((state) => selectGoalById(state, id));
  const progress = useSelector((state) => selectGoalProgressById(state, id), shallowEqual);

  const dispatch = useDispatch();

  const handleClick = useCallback(() => {
    dispatch(entryActions.openGoalModal(id));
  }, [id, dispatch]);

  if (!goal) {
    return null;
  }

  return (
    <button type="button" className={styles.chip} onClick={handleClick}>
      <Icon name="bullseye" className={styles.icon} />
      <span className={styles.name}>{goal.name}</span>
      <span className={styles.percent}>{progress.percent}%</span>
    </button>
  );
});

GoalChip.propTypes = {
  id: PropTypes.string.isRequired,
};

export default GoalChip;
