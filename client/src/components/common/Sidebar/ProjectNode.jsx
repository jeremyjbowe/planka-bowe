/*!
 * planka-bowe — one project row in the sidebar tree, with its boards and
 * sub-projects rendered only while it is expanded.
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link } from 'react-router';
import { Icon } from 'semantic-ui-react';

import Paths from '../../../constants/Paths';

import styles from './Sidebar.module.scss';

const INDENT = 14;

const ProjectNode = React.memo(
  ({ node, depth, currentProjectId, currentBoardId, isNodeExpanded, onToggleExpanded }) => {
    const isExpanded = isNodeExpanded(node.id);
    const hasChildren = node.boards.length > 0 || node.children.length > 0;
    const isActive = node.id === currentProjectId;

    const handleToggleClick = useCallback(
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggleExpanded(node.id);
      },
      [node.id, onToggleExpanded],
    );

    const projectPath =
      node.boards.length > 0
        ? Paths.BOARDS.replace(':id', node.boards[0].id)
        : Paths.PROJECTS.replace(':id', node.id);

    return (
      <li className={styles.node}>
        <div
          className={classNames(styles.row, isActive && !currentBoardId && styles.rowActive)}
          style={{ paddingLeft: 8 + depth * INDENT }}
        >
          <button
            type="button"
            className={classNames(styles.chevron, !hasChildren && styles.chevronHidden)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={handleToggleClick}
          >
            <Icon fitted name={isExpanded ? 'chevron down' : 'chevron right'} />
          </button>
          <Link to={projectPath} className={styles.rowLink} title={node.name}>
            <Icon
              fitted
              name={node.children.length > 0 ? 'folder open outline' : 'folder outline'}
              className={styles.rowIcon}
            />
            <span className={styles.rowLabel}>{node.name}</span>
            {node.isFavorite && <Icon fitted name="star" className={styles.rowStar} />}
          </Link>
        </div>
        {isExpanded && hasChildren && (
          <ul className={styles.children}>
            {node.boards.map((board) => (
              <li key={board.id} className={styles.node}>
                <Link
                  to={Paths.BOARDS.replace(':id', board.id)}
                  className={classNames(
                    styles.row,
                    styles.boardRow,
                    board.id === currentBoardId && styles.rowActive,
                  )}
                  style={{ paddingLeft: 8 + (depth + 1) * INDENT + 22 }}
                  title={board.name}
                >
                  <Icon fitted name="columns" className={styles.rowIcon} />
                  <span className={styles.rowLabel}>{board.name}</span>
                </Link>
              </li>
            ))}
            {node.children.map((child) => (
              <ProjectNode
                key={child.id}
                node={child}
                depth={depth + 1}
                currentProjectId={currentProjectId}
                currentBoardId={currentBoardId}
                isNodeExpanded={isNodeExpanded}
                onToggleExpanded={onToggleExpanded}
              />
            ))}
          </ul>
        )}
      </li>
    );
  },
);

const nodeShape = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  isFavorite: PropTypes.bool,
  boards: PropTypes.array.isRequired,
  children: PropTypes.array.isRequired,
};

ProjectNode.propTypes = {
  node: PropTypes.shape(nodeShape).isRequired,
  depth: PropTypes.number.isRequired,
  currentProjectId: PropTypes.string,
  currentBoardId: PropTypes.string,
  isNodeExpanded: PropTypes.func.isRequired,
  onToggleExpanded: PropTypes.func.isRequired,
};

ProjectNode.defaultProps = {
  currentProjectId: undefined,
  currentBoardId: undefined,
};

export default ProjectNode;
