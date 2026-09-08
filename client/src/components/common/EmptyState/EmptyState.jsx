/*!
 * DTP fork — EmptyState.
 *
 * A calm, centered placeholder with an icon, a title, a one-line hint and an
 * optional action row. Used wherever a surface has nothing to show yet.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Icon } from 'semantic-ui-react';

import styles from './EmptyState.module.scss';

const Sizes = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
};

const EmptyState = React.memo(({ icon, title, hint, size, className, children }) => (
  <div className={classNames(styles.wrapper, styles[size], className)}>
    <div className={styles.iconWrapper}>
      <Icon name={icon} className={styles.icon} />
    </div>
    <div className={styles.title}>{title}</div>
    {hint && <div className={styles.hint}>{hint}</div>}
    {children && <div className={styles.actions}>{children}</div>}
  </div>
));

EmptyState.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  hint: PropTypes.string,
  size: PropTypes.oneOf(Object.values(Sizes)),
  className: PropTypes.string,
  children: PropTypes.node,
};

EmptyState.defaultProps = {
  hint: undefined,
  size: Sizes.MEDIUM,
  className: undefined,
  children: undefined,
};

export default EmptyState;
