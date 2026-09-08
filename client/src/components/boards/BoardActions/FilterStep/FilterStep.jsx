/*!
 * DTP fork — FilterStep. Due date, priority, status and "assigned to me"
 * for the current board. All of it is client-only state on the Board model.
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';
import { Popup } from '../../../../lib/custom-ui';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import { CardDueFilters, CardPriorities, CardStatusFilters } from '../../../../constants/Enums';
import PriorityChip from '../../../cards/PriorityChip';

import styles from './FilterStep.module.scss';

const DUE_OPTIONS = [
  [null, 'common.any'],
  [CardDueFilters.OVERDUE, 'common.dueOverdue'],
  [CardDueFilters.TODAY, 'common.dueToday'],
  [CardDueFilters.THIS_WEEK, 'common.dueThisWeek'],
  [CardDueFilters.NO_DATE, 'common.dueNoDate'],
];

const STATUS_OPTIONS = [
  [null, 'common.any'],
  [CardStatusFilters.OPEN, 'common.statusOpen'],
  [CardStatusFilters.DONE, 'common.statusDone'],
];

const PRIORITIES = [
  CardPriorities.URGENT,
  CardPriorities.HIGH,
  CardPriorities.MEDIUM,
  CardPriorities.LOW,
];

const FilterStep = React.memo(({ onBack }) => {
  const filters = useSelector(selectors.selectFiltersForCurrentBoard);

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleDueClick = useCallback(
    ({
      currentTarget: {
        dataset: { value },
      },
    }) => {
      dispatch(
        entryActions.updateFiltersInCurrentBoard({
          filterDue: value || null,
        }),
      );
    },
    [dispatch],
  );

  const handleStatusClick = useCallback(
    ({
      currentTarget: {
        dataset: { value },
      },
    }) => {
      dispatch(
        entryActions.updateFiltersInCurrentBoard({
          filterStatus: value || null,
        }),
      );
    },
    [dispatch],
  );

  const handlePriorityClick = useCallback(
    ({
      currentTarget: {
        dataset: { value },
      },
    }) => {
      const priorities = filters ? filters.filterPriorities : [];

      dispatch(
        entryActions.updateFiltersInCurrentBoard({
          filterPriorities: priorities.includes(value)
            ? priorities.filter((priority) => priority !== value)
            : [...priorities, value],
        }),
      );
    },
    [filters, dispatch],
  );

  const handleAssignedToMeClick = useCallback(() => {
    dispatch(
      entryActions.updateFiltersInCurrentBoard({
        filterAssignedToMe: !(filters && filters.filterAssignedToMe),
      }),
    );
  }, [filters, dispatch]);

  const handleClearClick = useCallback(() => {
    dispatch(entryActions.clearFiltersInCurrentBoard());
  }, [dispatch]);

  if (!filters) {
    return null;
  }

  const isAnyFilterActive =
    !!filters.search ||
    filters.filterUserIds.length > 0 ||
    filters.filterLabelIds.length > 0 ||
    !!filters.filterDue ||
    filters.filterPriorities.length > 0 ||
    !!filters.filterStatus ||
    filters.filterAssignedToMe;

  return (
    <>
      <Popup.Header onBack={onBack}>{t('common.filter')}</Popup.Header>
      <Popup.Content>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('common.dueDate')}</div>
          <div className={styles.chips}>
            {DUE_OPTIONS.map(([value, labelKey]) => (
              <button
                key={labelKey}
                type="button"
                data-value={value || ''}
                className={classNames(
                  styles.chip,
                  (filters.filterDue || null) === value && styles.chipActive,
                )}
                onClick={handleDueClick}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('common.priority')}</div>
          <div className={styles.chips}>
            {PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                data-value={priority}
                className={classNames(
                  styles.priorityChip,
                  filters.filterPriorities.includes(priority) && styles.priorityChipActive,
                )}
                onClick={handlePriorityClick}
              >
                <PriorityChip value={priority} size="small" />
              </button>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('common.status')}</div>
          <div className={styles.chips}>
            {STATUS_OPTIONS.map(([value, labelKey]) => (
              <button
                key={labelKey}
                type="button"
                data-value={value || ''}
                className={classNames(
                  styles.chip,
                  (filters.filterStatus || null) === value && styles.chipActive,
                )}
                onClick={handleStatusClick}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <button
            type="button"
            className={classNames(styles.toggle, filters.filterAssignedToMe && styles.toggleActive)}
            onClick={handleAssignedToMeClick}
          >
            <Icon
              name={filters.filterAssignedToMe ? 'check square' : 'square outline'}
              className={styles.toggleIcon}
            />
            {t('common.assignedToMe')}
          </button>
        </div>
        <Button
          fluid
          content={t('action.clearFilters')}
          disabled={!isAnyFilterActive}
          className={styles.clearButton}
          onClick={handleClearClick}
        />
      </Popup.Content>
    </>
  );
});

FilterStep.propTypes = {
  onBack: PropTypes.func,
};

FilterStep.defaultProps = {
  onBack: undefined,
};

export default FilterStep;
