/*!
 * planka-bowe — GoalProgressBar. Animated bar with a percentage label.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import styles from './GoalProgressBar.module.scss';

const GoalProgressBar = React.memo(({ percent, size, withLabel, className }) => (
  <div className={classNames(styles.wrapper, styles[`size_${size}`], className)}>
    <div
      className={styles.track}
      role="progressbar"
      aria-label={`${percent}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className={classNames(styles.bar, percent >= 100 && styles.barComplete)}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
    {withLabel && <span className={styles.label}>{percent}%</span>}
  </div>
));

GoalProgressBar.propTypes = {
  percent: PropTypes.number.isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  withLabel: PropTypes.bool,
  className: PropTypes.string,
};

GoalProgressBar.defaultProps = {
  size: 'medium',
  withLabel: true,
  className: undefined,
};

export default GoalProgressBar;
