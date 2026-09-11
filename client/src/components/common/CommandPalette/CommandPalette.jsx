/*!
 * planka-bowe — CommandPalette.
 *
 * One input for everything:
 *  - type a sentence to create a card (Quick Add). Tokens: @user, #label,
 *    !priority, ~project, plus natural-language dates ("tomorrow", "fri 3pm");
 *  - type a few letters to jump to a project or board, or open a card.
 *
 * Search is client-side over the redux-orm store; no backend endpoint is
 * involved (see docs/IMPLEMENTATION_PLAN.md for the deliberate deferral).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { push } from '../../../lib/redux-router';
import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import Paths from '../../../constants/Paths';
import Config from '../../../constants/Config';
import { CardTypes } from '../../../constants/Enums';
import { isModifierKeyPressed } from '../../../utils/event-helpers';
import { parseQuickAdd } from '../../../utils/quick-add-parser';
import UserAvatar from '../../users/UserAvatar';
import LabelChip from '../../labels/LabelChip';
import PriorityChip from '../../cards/PriorityChip';

import styles from './CommandPalette.module.scss';

const MAX_PER_GROUP = 6;

// Lets the header button (or anything else) open the palette without Redux.
const openListeners = new Set();

export const openCommandPalette = () => {
  openListeners.forEach((listener) => listener());
};

const matches = (name, needle) => name.toLowerCase().includes(needle);

const CommandPalette = React.memo(() => {
  const context = useSelector(selectors.selectQuickAddContext);
  const index = useSelector(selectors.selectSearchIndex);

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    openListeners.add(open);
    return () => openListeners.delete(open);
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isModifierKeyPressed(event) && event.key.toLowerCase() === 'k') {
        event.preventDefault();

        if (isOpen) {
          close();
        } else {
          open();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const parsed = useMemo(
    () =>
      parseQuickAdd(query, {
        users: context.users,
        labels: context.labels,
        projects: context.projects,
      }),
    [query, context],
  );

  const targetProject = useMemo(
    () =>
      parsed.projectId ? context.projects.find((project) => project.id === parsed.projectId) : null,
    [parsed.projectId, context.projects],
  );

  const canCreate =
    !!parsed.name && (targetProject ? !!targetProject.firstBoardId : !!context.firstListId);

  const items = useMemo(() => {
    const result = [];
    const needle = (parsed.name || query).trim().toLowerCase();

    if (parsed.name) {
      result.push({ type: 'create', key: 'create' });
    }

    const pick = (list, type) =>
      (needle ? list.filter((item) => matches(item.name, needle)) : list)
        .slice(0, needle ? MAX_PER_GROUP : 4)
        .forEach((item) => result.push({ type, key: `${type}:${item.id}`, item }));

    if (!needle || 'goals'.includes(needle) || matches(t('common.goals'), needle)) {
      result.push({ type: 'goals', key: 'goals' });
    }

    pick(index.boards, 'board');
    pick(index.projects, 'project');

    if (needle) {
      pick(index.cards, 'card');
    }

    return result;
  }, [parsed.name, query, index, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const execute = useCallback(
    (item) => {
      if (!item) {
        return;
      }

      switch (item.type) {
        case 'create': {
          if (!canCreate) {
            return;
          }

          const data = {
            name: parsed.name,
            type: context.defaultCardType || CardTypes.PROJECT,
            ...(parsed.dueDate && { dueDate: parsed.dueDate }),
            ...(parsed.priority && { priority: parsed.priority }),
          };

          if (targetProject) {
            dispatch(
              entryActions.quickCreateCard({
                boardId: targetProject.firstBoardId,
                data: { ...data, type: CardTypes.PROJECT },
                userIds: [],
                labelIds: [],
              }),
            );

            dispatch(push(Paths.BOARDS.replace(':id', targetProject.firstBoardId)));
          } else {
            dispatch(
              entryActions.quickCreateCard({
                listId: context.firstListId,
                data,
                userIds: parsed.userIds,
                labelIds: parsed.labelIds,
              }),
            );
          }

          break;
        }
        case 'goals':
          dispatch(push(Paths.GOALS));
          break;
        case 'board':
          dispatch(push(Paths.BOARDS.replace(':id', item.item.id)));
          break;
        case 'project':
          dispatch(push(Paths.PROJECTS.replace(':id', item.item.id)));
          break;
        case 'card':
          dispatch(push(Paths.CARDS.replace(':id', item.item.id)));
          break;
        default:
      }

      close();
    },
    [canCreate, parsed, context, targetProject, dispatch, close],
  );

  const handleInputKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((value) => Math.min(value + 1, items.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((value) => Math.max(value - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          execute(items[activeIndex]);
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          close();
          break;
        default:
      }
    },
    [items, activeIndex, execute, close],
  );

  const handleChange = useCallback(({ target: { value } }) => {
    setQuery(value);
  }, []);

  // Only a press on the backdrop itself closes the palette.
  const handleOverlayMouseDown = useCallback(
    (event) => {
      if (event.target === event.currentTarget) {
        close();
      }
    },
    [close],
  );

  if (!isOpen) {
    return null;
  }

  const renderCreateItem = () => (
    <div className={styles.createRow}>
      <div className={styles.createTitle}>
        <Icon name="plus" className={styles.createIcon} />
        <span>{t('common.createCardNamed', { name: parsed.name })}</span>
      </div>
      <div className={styles.createMeta}>
        {parsed.userIds.map((userId) => (
          <span key={userId} className={styles.metaChip}>
            <UserAvatar id={userId} size="tiny" />
          </span>
        ))}
        {parsed.labelIds.map((labelId) => (
          <span key={labelId} className={styles.metaChip}>
            <LabelChip id={labelId} size="tiny" />
          </span>
        ))}
        {parsed.priority && (
          <span className={styles.metaChip}>
            <PriorityChip value={parsed.priority} size="tiny" />
          </span>
        )}
        {parsed.dueDate && (
          <span className={classNames(styles.metaChip, styles.metaText)}>
            <Icon name="calendar check outline" />
            {t('format:longDateTime', {
              postProcess: 'formatDate',
              value: parsed.dueDate,
            })}
          </span>
        )}
        {targetProject && (
          <span className={classNames(styles.metaChip, styles.metaText)}>
            <Icon name="folder outline" />
            {targetProject.name}
          </span>
        )}
        {parsed.unresolved.map((token) => (
          <span key={token} className={classNames(styles.metaChip, styles.metaUnresolved)}>
            {t('common.unknownToken', { token })}
          </span>
        ))}
        {!canCreate && (
          <span className={classNames(styles.metaChip, styles.metaUnresolved)}>
            {t('common.openBoardToCreateCards')}
          </span>
        )}
      </div>
    </div>
  );

  const renderItem = (item) => {
    switch (item.type) {
      case 'create':
        return renderCreateItem();
      case 'goals':
        return (
          <div className={styles.row}>
            <Icon name="bullseye" className={styles.rowIcon} />
            <span className={styles.rowName}>{t('common.goals')}</span>
            <span className={styles.rowMeta}>{t('common.page')}</span>
          </div>
        );
      case 'board':
        return (
          <div className={styles.row}>
            <Icon name="columns" className={styles.rowIcon} />
            <span className={styles.rowName}>{item.item.name}</span>
            <span className={styles.rowMeta}>{item.item.projectName}</span>
          </div>
        );
      case 'project':
        return (
          <div className={styles.row}>
            <Icon name="folder outline" className={styles.rowIcon} />
            <span className={styles.rowName}>{item.item.name}</span>
            <span className={styles.rowMeta}>{t('common.project')}</span>
          </div>
        );
      case 'card':
        return (
          <div className={styles.row}>
            <Icon name="sticky note outline" className={styles.rowIcon} />
            <span
              className={classNames(styles.rowName, item.item.isClosed && styles.rowNameClosed)}
            >
              {item.item.name}
            </span>
            <span className={styles.rowMeta}>
              {item.item.boardName}
              {item.item.listName && ` · ${item.item.listName}`}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={styles.overlay} onMouseDown={handleOverlayMouseDown}>
      <div className={styles.panel} role="dialog" aria-label={t('common.commandPalette')}>
        <div className={styles.inputRow}>
          <Icon name="search" className={styles.inputIcon} />
          <input
            ref={inputRef}
            value={query}
            placeholder={t('common.searchOrCreate')}
            className={styles.input}
            spellCheck={false}
            onChange={handleChange}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className={styles.kbd}>esc</kbd>
        </div>
        <div className={styles.results}>
          {items.length === 0 ? (
            <div className={styles.empty}>{t('common.noResults')}</div>
          ) : (
            items.map((item, itemIndex) => (
              <button
                key={item.key}
                type="button"
                className={classNames(
                  styles.item,
                  itemIndex === activeIndex && styles.itemActive,
                  item.type === 'create' && !canCreate && styles.itemDisabled,
                )}
                onMouseEnter={() => setActiveIndex(itemIndex)}
                onClick={() => execute(item)}
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
        <div className={styles.footer}>
          <span>{t('common.commandPaletteHint')}</span>
          <span className={styles.footerKeys}>
            <kbd className={styles.kbd}>↑</kbd>
            <kbd className={styles.kbd}>↓</kbd>
            <kbd className={styles.kbd}>↵</kbd>
            <kbd className={styles.kbd}>{Config.IS_MAC ? '⌘' : 'Ctrl'} K</kbd>
            <kbd className={styles.kbd}>?</kbd>
          </span>
        </div>
      </div>
    </div>
  );
});

export default CommandPalette;
