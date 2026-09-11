/*!
 * planka-bowe — Table view.
 *
 * A spreadsheet-like view of the current board built on TanStack Table v9.
 * Rows are derived from the same redux-orm store the Kanban view reads, so a
 * card edited anywhere (including by another user over the socket) updates
 * here without any extra fetching. Sorting is local UI state, persisted per
 * board in localStorage so it survives a reload.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useInView } from 'react-intersection-observer';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Loader } from 'semantic-ui-react';
import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import { push } from '../../../../lib/redux-router';
import selectors from '../../../../selectors';
import { useKeyboardSelection } from '../../../../hooks';
import { subscribeToAddCardRequests } from '../../../../utils/keyboard-navigation';
import Paths from '../../../../constants/Paths';
import { BoardMembershipRoles, CARD_PRIORITY_RANK } from '../../../../constants/Enums';
import UserAvatar from '../../../users/UserAvatar';
import LabelChip from '../../../labels/LabelChip';
import DueDateChip from '../../../cards/DueDateChip';
import PriorityChip from '../../../cards/PriorityChip';
import AddCard from '../../../cards/AddCard';

import PlusMathIcon from '../../../../assets/images/plus-math-icon.svg?react';
import styles from './TableView.module.scss';

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(sortFns),
});

const EMPTY_ROWS = [];

const SORTING_STORAGE_PREFIX = 'bowe_tableSorting_';

const readStoredSorting = (boardId) => {
  try {
    const raw = localStorage.getItem(`${SORTING_STORAGE_PREFIX}${boardId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeStoredSorting = (boardId, sorting) => {
  try {
    localStorage.setItem(`${SORTING_STORAGE_PREFIX}${boardId}`, JSON.stringify(sorting));
  } catch {
    // Storage may be unavailable (private mode); sorting simply won't persist.
  }
};

// Sort helpers keep "empty" values at the bottom regardless of direction.
const compareNullable = (a, b, compare) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return compare(a, b);
};

const compareText = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/* Cell renderers live at module scope so React sees stable component types. */

function NameCell({ row }) {
  return (
    <span
      className={classNames(styles.name, row.original.isClosed && styles.nameClosed)}
      title={row.original.name}
    >
      {row.original.name}
    </span>
  );
}

function ListCell({ row }) {
  if (!row.original.listName) {
    return null;
  }

  return (
    <span className={styles.listChip}>
      <Icon name="columns" className={styles.listChipIcon} />
      {row.original.listName}
    </span>
  );
}

function MembersCell({ row }) {
  if (row.original.userIds.length === 0) {
    return <span className={styles.empty}>—</span>;
  }

  return (
    <span className={styles.avatars}>
      {row.original.userIds.map((userId) => (
        <span key={userId} className={styles.avatar}>
          <UserAvatar id={userId} size="tiny" />
        </span>
      ))}
    </span>
  );
}

function LabelsCell({ row }) {
  if (row.original.labelIds.length === 0) {
    return <span className={styles.empty}>—</span>;
  }

  return (
    <span className={styles.labels}>
      {row.original.labelIds.map((labelId) => (
        <span key={labelId} className={styles.label}>
          <LabelChip id={labelId} size="tiny" />
        </span>
      ))}
    </span>
  );
}

function DueDateCell({ row }) {
  if (!row.original.dueDate) {
    return <span className={styles.empty}>—</span>;
  }

  return (
    <DueDateChip
      withStatusIcon
      value={row.original.dueDate}
      size="tiny"
      isCompleted={row.original.isDueCompleted}
      withStatus={!row.original.isClosed}
    />
  );
}

function PriorityCell({ row }) {
  if (!row.original.priority) {
    return <span className={styles.empty}>—</span>;
  }

  return <PriorityChip value={row.original.priority} size="tiny" />;
}

function SubtasksCell({ row }) {
  const { subtasksTotal, subtasksCompleted } = row.original;

  if (subtasksTotal === 0) {
    return <span className={styles.empty}>—</span>;
  }

  const percent = Math.round((subtasksCompleted / subtasksTotal) * 100);

  return (
    <span className={styles.subtasks}>
      <span className={styles.subtasksTrack}>
        <span
          className={percent === 100 ? styles.subtasksBarComplete : styles.subtasksBar}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className={styles.subtasksCount}>
        {subtasksCompleted}/{subtasksTotal}
      </span>
    </span>
  );
}

function CreatedCell({ row }) {
  const [t] = useTranslation();

  return (
    <span className={styles.muted}>
      {t('format:fullDate', {
        postProcess: 'formatDate',
        value: row.original.createdAt,
      })}
    </span>
  );
}

NameCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};
ListCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};
MembersCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};
LabelsCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};
DueDateCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};
PriorityCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};

SubtasksCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};

CreatedCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  }).isRequired,
};

const SORT_ICON_BY_DIRECTION = {
  asc: 'sort up',
  desc: 'sort down',
};

const TableView = React.memo(
  ({ cardIds, isCardsFetching, isAllCardsFetched, onCardsFetch, onCardCreate, onCardPaste }) => {
    const selectTableRowsByCardIds = useMemo(() => selectors.makeSelectTableRowsByCardIds(), []);

    const boardId = useSelector((state) => selectors.selectCurrentBoard(state).id);
    const rows = useSelector((state) => selectTableRowsByCardIds(state, cardIds));
    const clipboard = useSelector(selectors.selectClipboard);

    const { canAddCard, canPasteCard } = useSelector((state) => {
      const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);
      const isEditor = !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;

      return {
        canAddCard: isEditor,
        canPasteCard: isEditor,
      };
    }, shallowEqual);

    // The keyboard cursor (utils/keyboard-navigation.js), shared with Card.
    const selectedCardId = useKeyboardSelection();

    const dispatch = useDispatch();
    const [t] = useTranslation();
    const [isAddCardOpened, setIsAddCardOpened] = useState(false);
    const [sorting, setSorting] = useState(() => readStoredSorting(boardId));

    const bodyRef = useRef(null);

    useEffect(() => {
      writeStoredSorting(boardId, sorting);
    }, [boardId, sorting]);

    // Rows are not components of their own, so the table scrolls the cursor.
    useEffect(() => {
      if (!selectedCardId || !bodyRef.current) {
        return;
      }

      const rowElement = bodyRef.current.querySelector(`[data-card-id="${selectedCardId}"]`);

      if (rowElement) {
        rowElement.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }, [selectedCardId]);

    // `n` (components/common/KeyboardNavigation) opens the single composer.
    useEffect(
      () =>
        subscribeToAddCardRequests(() => {
          if (onCardCreate) {
            setIsAddCardOpened(true);
          }
        }),
      [onCardCreate],
    );

    const [inViewRef] = useInView({
      threshold: 1,
      onChange: (inView) => {
        if (inView && onCardsFetch) {
          onCardsFetch();
        }
      },
    });

    const handleRowClick = useCallback(
      (cardId) => {
        dispatch(push(Paths.CARDS.replace(':id', cardId)));
      },
      [dispatch],
    );

    const handleAddCardClick = useCallback(() => {
      setIsAddCardOpened(true);
    }, []);

    const handleAddCardClose = useCallback(() => {
      setIsAddCardOpened(false);
    }, []);

    const columns = useMemo(
      () => [
        {
          id: 'name',
          accessorKey: 'name',
          header: t('common.title'),
          sortingFn: (rowA, rowB) => compareText(rowA.original.name, rowB.original.name),
          cell: NameCell,
        },
        {
          id: 'list',
          accessorFn: (row) => row.listName,
          header: t('common.list'),
          sortingFn: (rowA, rowB) =>
            compareNullable(
              rowA.original.listPosition,
              rowB.original.listPosition,
              (a, b) => a - b,
            ),
          cell: ListCell,
        },
        {
          id: 'members',
          accessorFn: (row) => row.userNames.join(', '),
          header: t('common.members'),
          sortingFn: (rowA, rowB) =>
            compareNullable(rowA.original.userNames[0], rowB.original.userNames[0], compareText),
          cell: MembersCell,
        },
        {
          id: 'labels',
          accessorFn: (row) => row.labelNames.join(', '),
          header: t('common.labels'),
          sortingFn: (rowA, rowB) =>
            compareNullable(rowA.original.labelNames[0], rowB.original.labelNames[0], compareText),
          cell: LabelsCell,
        },
        {
          id: 'dueDate',
          accessorFn: (row) => (row.dueDate ? row.dueDate.getTime() : null),
          header: t('common.dueDate', { context: 'title' }),
          sortingFn: (rowA, rowB) =>
            compareNullable(
              rowA.original.dueDate && rowA.original.dueDate.getTime(),
              rowB.original.dueDate && rowB.original.dueDate.getTime(),
              (a, b) => a - b,
            ),
          cell: DueDateCell,
        },
        {
          id: 'priority',
          accessorFn: (row) => row.priority,
          header: t('common.priority'),
          sortingFn: (rowA, rowB) =>
            compareNullable(
              CARD_PRIORITY_RANK[rowA.original.priority],
              CARD_PRIORITY_RANK[rowB.original.priority],
              (a, b) => a - b,
            ),
          cell: PriorityCell,
        },
        {
          id: 'subtasks',
          accessorFn: (row) => row.subtasksTotal,
          header: t('common.subtasks'),
          sortingFn: (rowA, rowB) => {
            const progressA =
              rowA.original.subtasksTotal === 0
                ? -1
                : rowA.original.subtasksCompleted / rowA.original.subtasksTotal;
            const progressB =
              rowB.original.subtasksTotal === 0
                ? -1
                : rowB.original.subtasksCompleted / rowB.original.subtasksTotal;

            return progressA - progressB;
          },
          cell: SubtasksCell,
        },
        {
          id: 'createdAt',
          accessorFn: (row) => row.createdAt.getTime(),
          header: t('common.created'),
          sortingFn: (rowA, rowB) =>
            rowA.original.createdAt.getTime() - rowB.original.createdAt.getTime(),
          cell: CreatedCell,
        },
      ],
      [t],
    );

    const table = useTable({
      features,
      columns,
      data: rows.length > 0 ? rows : EMPTY_ROWS,
      getRowId: (row) => row.id,
      sortDescFirst: false,
      state: { sorting },
      onSortingChange: setSorting,
      enableSortingRemoval: true,
    });

    const tableRows = table.getRowModel().rows;

    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          {canAddCard &&
            (onCardCreate && isAddCardOpened ? (
              <div className={styles.addCardForm}>
                <AddCard onCreate={onCardCreate} onClose={handleAddCardClose} />
              </div>
            ) : (
              <div className={styles.addCardButtonWrapper}>
                <Button
                  type="button"
                  disabled={!onCardCreate}
                  className={styles.addCardButton}
                  onClick={handleAddCardClick}
                >
                  <PlusMathIcon className={styles.addCardButtonIcon} />
                  <span className={styles.addCardButtonText}>
                    {onCardCreate ? t('action.addCard') : t('common.atLeastOneListMustBePresent')}
                  </span>
                </Button>
                {onCardPaste && clipboard && canPasteCard && (
                  <Button
                    type="button"
                    disabled={!onCardCreate}
                    className={classNames(styles.addCardButton, styles.paste)}
                    onClick={onCardPaste}
                  >
                    <Icon fitted name="paste" />
                  </Button>
                )}
              </div>
            ))}
          <span className={styles.count}>{t('common.cardsCount', { count: rows.length })}</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortDirection = header.column.getIsSorted();

                    return (
                      <th
                        key={header.id}
                        className={classNames(
                          styles.th,
                          styles[`column_${header.column.id}`],
                          sortDirection && styles.thSorted,
                        )}
                      >
                        <button
                          type="button"
                          aria-label={header.column.columnDef.header}
                          className={styles.headerButton}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span>
                            {header.isPlaceholder ? null : header.column.columnDef.header}
                          </span>
                          <Icon
                            name={sortDirection ? SORT_ICON_BY_DIRECTION[sortDirection] : 'sort'}
                            className={classNames(
                              styles.sortIcon,
                              sortDirection && styles.sortIconActive,
                            )}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody ref={bodyRef}>
              {tableRows.map((row) => (
                <tr
                  key={row.id}
                  data-card-id={row.original.id}
                  className={classNames(
                    styles.tr,
                    row.original.isClosed && styles.trClosed,
                    row.original.id === selectedCardId && styles.trSelected,
                  )}
                  onClick={() => handleRowClick(row.original.id)}
                >
                  {row.getAllCells().map((cell) => (
                    // eslint-disable-next-line jsx-a11y/control-has-associated-label
                    <td
                      key={cell.id}
                      className={classNames(styles.td, styles[`column_${cell.column.id}`])}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <Icon name="table" />
              </div>
              <div className={styles.emptyStateTitle}>{t('common.tableEmpty')}</div>
              <div className={styles.emptyStateHint}>{t('common.tableEmptyHint')}</div>
            </div>
          )}
          {isCardsFetching !== undefined && isAllCardsFetched !== undefined && (
            <div className={styles.loaderWrapper}>
              {isCardsFetching ? (
                <Loader active inverted inline="centered" size="small" />
              ) : (
                !isAllCardsFetched && <div ref={inViewRef} />
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

TableView.propTypes = {
  cardIds: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  isCardsFetching: PropTypes.bool,
  isAllCardsFetched: PropTypes.bool,
  onCardsFetch: PropTypes.func,
  onCardCreate: PropTypes.func,
  onCardPaste: PropTypes.func,
};

TableView.defaultProps = {
  isCardsFetching: undefined,
  isAllCardsFetched: undefined,
  onCardsFetch: undefined,
  onCardCreate: undefined,
  onCardPaste: undefined,
};

export default TableView;
