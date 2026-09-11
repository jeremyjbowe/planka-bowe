/*!
 * planka-bowe — SelectCardStep.
 *
 * A popup listing the cards of the current board with a search box. Used to
 * pick a parent card and to link an existing card as a subtask. Cards in
 * `excludedIds` are hidden so the caller can prevent cycles.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import { Input, Popup } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import { useField, useNestedRef } from '../../../hooks';

import styles from './SelectCardStep.module.scss';

const EMPTY_IDS = [];

const SelectCardStep = React.memo(
  ({ title, currentId, excludedIds, clearLabel, onSelect, onClear, onBack, onClose }) => {
    const cards = useSelector(selectors.selectCardsForCurrentBoard);

    const [t] = useTranslation();
    const [search, handleSearchChange] = useField('');
    const cleanSearch = useMemo(() => search.trim().toLowerCase(), [search]);

    const filteredCards = useMemo(
      () =>
        cards.filter(
          (card) => !excludedIds.includes(card.id) && card.name.toLowerCase().includes(cleanSearch),
        ),
      [cards, excludedIds, cleanSearch],
    );

    const [searchFieldRef, handleSearchFieldRef] = useNestedRef('inputRef');

    const handleSelectClick = useCallback(
      ({ currentTarget: { value } }) => {
        onSelect(value);
        onClose();
      },
      [onSelect, onClose],
    );

    const handleClearClick = useCallback(() => {
      onClear();
      onClose();
    }, [onClear, onClose]);

    useEffect(() => {
      searchFieldRef.current.focus({
        preventScroll: true,
      });
    }, [searchFieldRef]);

    return (
      <>
        <Popup.Header onBack={onBack}>{title}</Popup.Header>
        <Popup.Content>
          <Input
            fluid
            ref={handleSearchFieldRef}
            value={search}
            placeholder={t('common.searchCards')}
            maxLength={128}
            icon="search"
            onChange={handleSearchChange}
          />
          <div className={styles.items}>
            {currentId && onClear && (
              <button type="button" className={styles.item} onClick={handleClearClick}>
                <Icon name="minus circle" className={styles.itemIcon} />
                <span className={styles.itemName}>{clearLabel}</span>
              </button>
            )}
            {filteredCards.map((card) => (
              <button
                key={card.id}
                type="button"
                value={card.id}
                className={classNames(styles.item, card.id === currentId && styles.itemActive)}
                onClick={handleSelectClick}
              >
                <span className={classNames(styles.itemName, card.isClosed && styles.itemClosed)}>
                  {card.name}
                </span>
                {card.listName && <span className={styles.itemList}>{card.listName}</span>}
              </button>
            ))}
          </div>
        </Popup.Content>
      </>
    );
  },
);

SelectCardStep.propTypes = {
  title: PropTypes.string.isRequired,
  currentId: PropTypes.string,
  excludedIds: PropTypes.array, // eslint-disable-line react/forbid-prop-types
  clearLabel: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onClear: PropTypes.func,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

SelectCardStep.defaultProps = {
  currentId: undefined,
  excludedIds: EMPTY_IDS,
  clearLabel: undefined,
  onClear: undefined,
  onBack: undefined,
};

export default SelectCardStep;
