/*!
 * planka-bowe — popup to link a board or a card to a goal. Boards come from the
 * projects the user can see; cards from the boards loaded in this session.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import { Input, Popup } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useField, useNestedRef } from '../../../hooks';

import styles from './GoalModal.module.scss';

const MAX_RESULTS = 8;

const AddLinkStep = React.memo(({ goalId, onBack, onClose }) => {
  const index = useSelector(selectors.selectSearchIndex);
  const selectGoalLinksByGoalId = useMemo(() => selectors.makeSelectGoalLinksByGoalId(), []);
  const links = useSelector((state) => selectGoalLinksByGoalId(state, goalId));

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [search, handleSearchChange] = useField('');
  const [mode, setMode] = useState('board');
  const [searchFieldRef, handleSearchFieldRef] = useNestedRef('inputRef');

  useEffect(() => {
    searchFieldRef.current.focus({ preventScroll: true });
  }, [searchFieldRef]);

  const linkedIds = useMemo(() => new Set(links.map((link) => link.targetId)), [links]);
  const needle = search.trim().toLowerCase();

  const results = useMemo(() => {
    const source = mode === 'board' ? index.boards : index.cards;

    return source
      .filter((item) => !linkedIds.has(item.id) && item.name.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS);
  }, [mode, index, linkedIds, needle]);

  const handleSelect = useCallback(
    (id) => {
      dispatch(
        entryActions.createGoalLink(goalId, mode === 'board' ? { boardId: id } : { cardId: id }),
      );
      onClose();
    },
    [goalId, mode, dispatch, onClose],
  );

  return (
    <>
      <Popup.Header onBack={onBack}>{t('action.linkToGoal')}</Popup.Header>
      <Popup.Content>
        <div className={styles.modeSwitch}>
          {['board', 'card'].map((value) => (
            <button
              key={value}
              type="button"
              className={classNames(styles.modeButton, mode === value && styles.modeButtonActive)}
              onClick={() => setMode(value)}
            >
              {value === 'board' ? t('common.linkBoard') : t('common.linkCard')}
            </button>
          ))}
        </div>
        <Input
          fluid
          ref={handleSearchFieldRef}
          value={search}
          placeholder={mode === 'board' ? t('common.searchBoards') : t('common.searchCards')}
          maxLength={128}
          icon="search"
          onChange={handleSearchChange}
        />
        <div className={styles.results}>
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.result}
              onClick={() => handleSelect(item.id)}
            >
              <Icon
                name={mode === 'board' ? 'columns' : 'sticky note outline'}
                className={styles.resultIcon}
              />
              <span className={styles.resultName}>{item.name}</span>
              <span className={styles.resultMeta}>
                {mode === 'board' ? item.projectName : item.boardName}
              </span>
            </button>
          ))}
          {results.length === 0 && <div className={styles.linksEmpty}>{t('common.noResults')}</div>}
        </div>
      </Popup.Content>
    </>
  );
});

AddLinkStep.propTypes = {
  goalId: PropTypes.string.isRequired,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

AddLinkStep.defaultProps = {
  onBack: undefined,
};

export default AddLinkStep;
