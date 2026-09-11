/*!
 * planka-bowe — GoalsStep. Checkbox list of goals; toggling links or unlinks
 * the given card.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import { Input, Popup } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useField, useNestedRef } from '../../../hooks';

import styles from './GoalsStep.module.scss';

const GoalsStep = React.memo(({ cardId, onBack }) => {
  const goals = useSelector(selectors.selectGoalOptions, shallowEqual);
  const linkedGoalIds = useSelector(selectors.selectGoalIdsForCurrentCard, shallowEqual);
  const selectGoalLinkIdByGoalIdAndCardId = useMemo(
    () => selectors.makeSelectGoalLinkIdByGoalIdAndCardId(),
    [],
  );

  const goalLinkIdByGoalId = useSelector(
    (state) =>
      Object.fromEntries(
        goals.map((goal) => [goal.id, selectGoalLinkIdByGoalIdAndCardId(state, goal.id, cardId)]),
      ),
    shallowEqual,
  );

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [search, handleSearchChange] = useField('');
  const [searchFieldRef, handleSearchFieldRef] = useNestedRef('inputRef');

  useEffect(() => {
    searchFieldRef.current.focus({ preventScroll: true });
  }, [searchFieldRef]);

  const needle = search.trim().toLowerCase();
  const filteredGoals = goals.filter((goal) => goal.name.toLowerCase().includes(needle));

  const handleToggle = useCallback(
    (goalId) => {
      const goalLinkId = goalLinkIdByGoalId[goalId];

      if (goalLinkId) {
        dispatch(entryActions.deleteGoalLink(goalLinkId));
      } else {
        dispatch(entryActions.createGoalLink(goalId, { cardId }));
      }
    },
    [cardId, goalLinkIdByGoalId, dispatch],
  );

  return (
    <>
      <Popup.Header onBack={onBack}>{t('common.goals')}</Popup.Header>
      <Popup.Content>
        <Input
          fluid
          ref={handleSearchFieldRef}
          value={search}
          placeholder={t('common.searchOrCreate')}
          maxLength={128}
          icon="search"
          onChange={handleSearchChange}
        />
        <div className={styles.items}>
          {filteredGoals.map((goal) => {
            const isLinked = linkedGoalIds.includes(goal.id);

            return (
              <button
                key={goal.id}
                type="button"
                className={classNames(styles.item, isLinked && styles.itemActive)}
                onClick={() => handleToggle(goal.id)}
              >
                <Icon
                  name={isLinked ? 'check square' : 'square outline'}
                  className={styles.check}
                />
                <span className={styles.name}>{goal.name}</span>
              </button>
            );
          })}
          {filteredGoals.length === 0 && (
            <div className={styles.empty}>{t('common.noGoalsYet')}</div>
          )}
        </div>
      </Popup.Content>
    </>
  );
});

GoalsStep.propTypes = {
  cardId: PropTypes.string.isRequired,
  onBack: PropTypes.func,
};

GoalsStep.defaultProps = {
  onBack: undefined,
};

export default GoalsStep;
