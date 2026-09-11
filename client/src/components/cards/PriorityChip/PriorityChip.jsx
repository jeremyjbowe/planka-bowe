/*!
 * planka-bowe — PriorityChip. A small colored pill for a card's priority.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { CardPriorities } from '../../../constants/Enums';

import styles from './PriorityChip.module.scss';

const Sizes = {
  TINY: 'tiny',
  SMALL: 'small',
  MEDIUM: 'medium',
};

export const PRIORITY_LABEL_KEYS = {
  [CardPriorities.LOW]: 'common.priorityLow',
  [CardPriorities.MEDIUM]: 'common.priorityMedium',
  [CardPriorities.HIGH]: 'common.priorityHigh',
  [CardPriorities.URGENT]: 'common.priorityUrgent',
};

const ICON_BY_PRIORITY = {
  [CardPriorities.LOW]: 'angle down',
  [CardPriorities.MEDIUM]: 'minus',
  [CardPriorities.HIGH]: 'angle up',
  [CardPriorities.URGENT]: 'angle double up',
};

const PriorityChip = React.memo(({ value, size, onClick }) => {
  const [t] = useTranslation();

  const content = (
    <>
      <Icon name={ICON_BY_PRIORITY[value]} className={styles.icon} />
      {t(PRIORITY_LABEL_KEYS[value])}
    </>
  );

  const className = classNames(styles.wrapper, styles[value], styles[`size_${size}`]);

  if (onClick) {
    return (
      <button type="button" className={classNames(className, styles.clickable)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
});

PriorityChip.propTypes = {
  value: PropTypes.oneOf(Object.values(CardPriorities)).isRequired,
  size: PropTypes.oneOf(Object.values(Sizes)),
  onClick: PropTypes.func,
};

PriorityChip.defaultProps = {
  size: Sizes.MEDIUM,
  onClick: undefined,
};

export default PriorityChip;
