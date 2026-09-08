/*!
 * DTP fork — Sidebar.
 *
 * A persistent, collapsible left rail that renders the user's projects as a
 * tree (sub-projects nest under their parent; boards are the leaves). The
 * boards of a sub-project are only rendered while its parent is expanded.
 *
 * Layout: the sidebar publishes its width through the `--sidebar-width` CSS
 * variable on <html>; Fixed and Static offset themselves by it.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import Paths from '../../../constants/Paths';
import { UserRoles } from '../../../constants/Enums';
import ProjectNode from './ProjectNode';
import { useTheme } from '../../../hooks';
import { Themes, cycleThemePreference } from '../../../utils/theme';

import styles from './Sidebar.module.scss';

const EXPANDED_WIDTH = 264;
const COLLAPSED_WIDTH = 56;
const MOBILE_BREAKPOINT = 768;

const COLLAPSED_STORAGE_KEY = 'dtp_sidebarCollapsed';
const EXPANDED_NODES_STORAGE_KEY = 'dtp_sidebarExpandedProjects';

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; the sidebar simply forgets its state.
  }
};

const Sidebar = React.memo(() => {
  const tree = useSelector(selectors.selectProjectTreeForCurrentUser);
  const { projectId, boardId } = useSelector(selectors.selectPath);
  const isGoalsPage = useSelector(selectors.selectIsGoalsPage);
  const ancestorProjects = useSelector(selectors.selectAncestorProjectsForCurrentProject);

  const canAddProject = useSelector((state) => {
    const user = selectors.selectCurrentUser(state);
    return !!user && (user.role === UserRoles.ADMIN || user.role === UserRoles.PROJECT_OWNER);
  });

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const { theme } = useTheme();

  const [isCollapsed, setIsCollapsed] = useState(() =>
    readStorage(COLLAPSED_STORAGE_KEY, window.innerWidth < MOBILE_BREAKPOINT),
  );

  // Explicit user choices, persisted. Anything not in here falls back to
  // "expanded when it is the current project or one of its ancestors".
  const [expansionById, setExpansionById] = useState(() =>
    readStorage(EXPANDED_NODES_STORAGE_KEY, {}),
  );

  const impliedExpandedIds = useMemo(() => {
    const ids = new Set();

    if (projectId) {
      ids.add(projectId);
      ancestorProjects.forEach((project) => ids.add(project.id));
    }

    return ids;
  }, [projectId, ancestorProjects]);

  const isNodeExpanded = useCallback(
    (id) => (id in expansionById ? expansionById[id] : impliedExpandedIds.has(id)),
    [expansionById, impliedExpandedIds],
  );

  useEffect(() => {
    const width = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);

    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
    };
  }, [isCollapsed]);

  const handleToggleCollapsed = useCallback(() => {
    setIsCollapsed((value) => {
      writeStorage(COLLAPSED_STORAGE_KEY, !value);
      return !value;
    });
  }, []);

  const handleToggleExpanded = useCallback(
    (id) => {
      setExpansionById((current) => {
        const next = { ...current, [id]: !isNodeExpanded(id) };
        writeStorage(EXPANDED_NODES_STORAGE_KEY, next);
        return next;
      });
    },
    [isNodeExpanded],
  );

  const handleAddProjectClick = useCallback(() => {
    dispatch(entryActions.openAddProjectModal());
  }, [dispatch]);

  return (
    <aside
      className={classNames(styles.wrapper, isCollapsed && styles.wrapperCollapsed)}
      aria-label={t('common.projects')}
    >
      <div className={styles.top}>
        <button
          type="button"
          className={styles.toggle}
          title={isCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
          onClick={handleToggleCollapsed}
        >
          <Icon fitted name={isCollapsed ? 'sidebar' : 'angle double left'} />
        </button>
        {!isCollapsed && (
          <Link to={Paths.ROOT} className={styles.brand}>
            <span className={styles.brandMark} />
            <span className={styles.brandName}>PLANKA</span>
          </Link>
        )}
      </div>
      <nav className={styles.nav}>
        <Link
          to={Paths.ROOT}
          className={classNames(
            styles.homeLink,
            projectId === undefined && !isGoalsPage && styles.homeLinkActive,
          )}
          title={t('common.home')}
        >
          <Icon fitted name="home" className={styles.homeIcon} />
          {!isCollapsed && <span className={styles.homeLabel}>{t('common.home')}</span>}
        </Link>
        <Link
          to={Paths.GOALS}
          className={classNames(styles.homeLink, isGoalsPage && styles.homeLinkActive)}
          title={t('common.goals')}
        >
          <Icon fitted name="bullseye" className={styles.homeIcon} />
          {!isCollapsed && <span className={styles.homeLabel}>{t('common.goals')}</span>}
        </Link>
        {!isCollapsed && (
          <>
            <div className={styles.sectionTitle}>{t('common.projects')}</div>
            {tree.length === 0 ? (
              <div className={styles.empty}>{t('common.noProjectsYet')}</div>
            ) : (
              <ul className={styles.tree}>
                {tree.map((node) => (
                  <ProjectNode
                    key={node.id}
                    node={node}
                    depth={0}
                    currentProjectId={projectId}
                    currentBoardId={boardId}
                    isNodeExpanded={isNodeExpanded}
                    onToggleExpanded={handleToggleExpanded}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </nav>
      <div className={styles.bottom}>
        <button
          type="button"
          className={styles.themeButton}
          title={t('common.theme')}
          onClick={cycleThemePreference}
        >
          <Icon fitted name={theme === Themes.DARK ? 'moon outline' : 'sun outline'} />
          {!isCollapsed && (
            <span>{theme === Themes.DARK ? t('common.themeDark') : t('common.themeLight')}</span>
          )}
        </button>
      </div>
      {canAddProject && (
        <div className={styles.bottom}>
          <button
            type="button"
            className={styles.addButton}
            title={t('action.createProject')}
            onClick={handleAddProjectClick}
          >
            <Icon fitted name="plus" className={styles.addIcon} />
            {!isCollapsed && <span>{t('action.createProject')}</span>}
          </button>
        </div>
      )}
    </aside>
  );
});

export default Sidebar;
