/*!
 * DTP fork — Timeline view.
 *
 * Renders every card that has a due date as a draggable bar on a frappe-gantt
 * chart. The data comes from the same redux-orm selector the Table view uses,
 * so bars move live when a due date changes anywhere (including from another
 * client over the socket). Dragging a bar or its edge dispatches the regular
 * `updateCard` entry action, which persists the new due date through the
 * existing saga → API → PostgreSQL path.
 *
 * Planka cards have no start date, so a bar always spans the due date's day;
 * the bar end is the source of truth for the due date.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import Gantt from 'frappe-gantt';
import { endOfDay, format, isBefore, startOfDay } from 'date-fns';

import { push } from '../../../../lib/redux-router';
import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import Paths from '../../../../constants/Paths';
import { BoardMembershipRoles } from '../../../../constants/Enums';
import UserAvatar from '../../../users/UserAvatar';

import '../../../../lib/frappe-gantt/frappe-gantt.css';
import styles from './TimelineView.module.scss';

const GANTT_DATE_FORMAT = 'yyyy-MM-dd HH:mm';

const VIEW_MODES = ['Day', 'Week', 'Month'];

const VIEW_MODE_LABEL_KEYS = {
  Day: 'common.viewModeDay',
  Week: 'common.viewModeWeek',
  Month: 'common.viewModeMonth',
};

const VIEW_MODE_STORAGE_KEY = 'dtp_timelineViewMode';

const readStoredViewMode = () => {
  try {
    const value = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return VIEW_MODES.includes(value) ? value : 'Week';
  } catch {
    return 'Week';
  }
};

const getBarClassName = (row, now) => {
  if (row.isClosed) {
    return 'dtp-bar-closed';
  }

  if (row.isDueCompleted) {
    return 'dtp-bar-completed';
  }

  if (isBefore(row.dueDate, now)) {
    return 'dtp-bar-overdue';
  }

  return 'dtp-bar-open';
};

// Keeps the original time of day while moving the due date to another day.
const withTimeOfDay = (day, timeSource) => {
  const result = new Date(day);
  result.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  );
  return result;
};

const TimelineView = React.memo(({ cardIds }) => {
  const selectTableRowsByCardIds = useMemo(() => selectors.makeSelectTableRowsByCardIds(), []);

  const rows = useSelector((state) => selectTableRowsByCardIds(state, cardIds));
  const canEdit = useSelector((state) => {
    const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);
    return !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;
  });

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [viewMode, setViewMode] = useState(readStoredViewMode);
  const [isUnscheduledOpened, setIsUnscheduledOpened] = useState(true);

  const containerRef = useRef(null);
  const ganttRef = useRef(null);
  const rowsByIdRef = useRef({});

  const { scheduledRows, unscheduledRows } = useMemo(() => {
    const scheduled = rows
      .filter((row) => row.dueDate)
      .sort((rowA, rowB) => rowA.dueDate - rowB.dueDate);

    return {
      scheduledRows: scheduled,
      unscheduledRows: rows.filter((row) => !row.dueDate),
    };
  }, [rows]);

  useEffect(() => {
    rowsByIdRef.current = Object.fromEntries(rows.map((row) => [row.id, row]));
  }, [rows]);

  const tasks = useMemo(() => {
    const now = new Date();

    // frappe-gantt mutates task objects, so build fresh ones on every change.
    return scheduledRows.map((row) => ({
      id: row.id,
      name: row.name,
      start: format(startOfDay(row.dueDate), GANTT_DATE_FORMAT),
      end: format(endOfDay(row.dueDate), GANTT_DATE_FORMAT),
      progress: row.isClosed || row.isDueCompleted ? 100 : 0,
      custom_class: getBarClassName(row, now),
    }));
  }, [scheduledRows]);

  const handleCardOpen = useCallback(
    (cardId) => {
      dispatch(push(Paths.CARDS.replace(':id', cardId)));
    },
    [dispatch],
  );

  const handleDateChange = useCallback(
    (task, _start, end) => {
      const row = rowsByIdRef.current[task.id];

      if (!row || !row.dueDate) {
        return;
      }

      const nextDueDate = withTimeOfDay(end, row.dueDate);

      if (nextDueDate.getTime() === row.dueDate.getTime()) {
        return;
      }

      dispatch(
        entryActions.updateCard(task.id, {
          dueDate: nextDueDate,
        }),
      );
    },
    [dispatch],
  );

  const handleViewModeClick = useCallback(({ currentTarget: { value } }) => {
    setViewMode(value);

    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, value);
    } catch {
      // Ignore storage errors; the choice simply will not persist.
    }
  }, []);

  const handleUnscheduledToggle = useCallback(() => {
    setIsUnscheduledOpened((value) => !value);
  }, []);

  // Keep the latest callbacks reachable from the long-lived Gantt instance.
  const handlersRef = useRef({});
  handlersRef.current = { handleCardOpen, handleDateChange };

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) {
      ganttRef.current = null;
      return undefined;
    }

    const container = containerRef.current;

    const gantt = new Gantt(container, tasks, {
      view_mode: viewMode,
      bar_height: 30,
      bar_corner_radius: 6,
      padding: 14,
      lines: 'horizontal',
      readonly: !canEdit,
      readonly_progress: true,
      today_button: true,
      view_mode_select: false,
      scroll_to: 'today',
      upper_header_height: 40,
      lower_header_height: 28,
      popup_on: 'hover',
      popup: (context) => {
        const row = rowsByIdRef.current[context.task.id];

        context.set_title(context.task.name);
        context.set_subtitle(row && row.listName ? row.listName : '');
        context.set_details(
          row && row.dueDate
            ? t('format:fullDateTime', {
                postProcess: 'formatDate',
                value: row.dueDate,
              })
            : '',
        );
      },
      on_click: (task) => handlersRef.current.handleCardOpen(task.id),
      on_date_change: (task, start, end) => handlersRef.current.handleDateChange(task, start, end),
    });

    ganttRef.current = gantt;

    return () => {
      ganttRef.current = null;
      container.innerHTML = '';
    };
    // The chart is rebuilt only when the view mode or edit permission changes;
    // data updates go through `refresh` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, canEdit, tasks.length === 0]);

  useEffect(() => {
    if (!ganttRef.current || tasks.length === 0) {
      return;
    }

    // `refresh` rebuilds the SVG and scrolls back to "today"; restore the
    // user's horizontal position so a drag does not jump the viewport.
    const scroller = containerRef.current && containerRef.current.querySelector('.gantt-container');
    const { scrollLeft, scrollTop } = scroller || { scrollLeft: 0, scrollTop: 0 };

    ganttRef.current.refresh(tasks);

    if (scroller) {
      scroller.scrollLeft = scrollLeft;
      scroller.scrollTop = scrollTop;
    }
  }, [tasks]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.viewModes}>
            {VIEW_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                value={mode}
                className={classNames(styles.viewModeButton, mode === viewMode && styles.active)}
                onClick={handleViewModeClick}
              >
                {t(VIEW_MODE_LABEL_KEYS[mode])}
              </button>
            ))}
          </div>
          <span className={styles.count}>
            {t('common.cardsCount', { count: scheduledRows.length })}
          </span>
        </div>
        <div className={styles.chartWrapper}>
          {tasks.length > 0 ? (
            <div ref={containerRef} className={styles.chart} />
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <Icon name="align left" />
              </div>
              <div className={styles.emptyStateTitle}>{t('common.timelineEmpty')}</div>
              <div className={styles.emptyStateHint}>{t('common.timelineEmptyHint')}</div>
            </div>
          )}
        </div>
      </div>
      {unscheduledRows.length > 0 && (
        <aside className={classNames(styles.side, !isUnscheduledOpened && styles.sideCollapsed)}>
          <button type="button" className={styles.sideHeader} onClick={handleUnscheduledToggle}>
            <Icon name={isUnscheduledOpened ? 'chevron right' : 'chevron left'} />
            <span className={styles.sideTitle}>
              {t('common.unscheduled')}
              <span className={styles.sideCount}>{unscheduledRows.length}</span>
            </span>
          </button>
          {isUnscheduledOpened && (
            <div className={styles.sideList}>
              {unscheduledRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={styles.sideItem}
                  onClick={() => handleCardOpen(row.id)}
                >
                  <span className={styles.sideItemName}>{row.name}</span>
                  <span className={styles.sideItemMeta}>
                    {row.listName && <span className={styles.sideItemList}>{row.listName}</span>}
                    {row.userIds.slice(0, 3).map((userId) => (
                      <UserAvatar key={userId} id={userId} size="tiny" />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
});

TimelineView.propTypes = {
  cardIds: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default TimelineView;
