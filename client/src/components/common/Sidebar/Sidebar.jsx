/*!
 * DTP fork — Sidebar.
 *
 * A persistent, collapsible left rail that renders the user's projects as a
 * tree (sub-projects nest under their parent; boards are the leaves). The
 * boards of a sub-project are only rendered while its parent is expanded.
 *
 * Layout: the sidebar publishes its width through the `--sidebar-width` CSS
 * variable on <html>; Fixed and Static offset themselves by it.
 *
 * Below `MOBILE_BREAKPOINT` the rail becomes an off-canvas drawer instead:
 * `--sidebar-width` is pinned to 0 (so the header/content always use the
 * full viewport width) and the drawer itself is shown/hidden by sliding it
 * on/off screen. `toggleSidebar` (exported below) lets the header's
 * hamburger button open it without any shared Redux state, mirroring how
 * `openCommandPalette` works.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
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
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const COLLAPSED_STORAGE_KEY = 'dtp_sidebarCollapsed';
const EXPANDED_NODES_STORAGE_KEY = 'dtp_sidebarExpandedProjects';

// Lets the header's hamburger button (or anything else) open the mobile
// drawer without Redux, mirroring CommandPalette's `openCommandPalette`.
const openListeners = new Set();

export const toggleSidebar = () => {
  openListeners.forEach((listener) => listener());
};

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
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(() => readStorage(COLLAPSED_STORAGE_KEY, false));

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  // Publish the sidebar's width so Fixed/Static can offset themselves by it.
  // On mobile the drawer floats above the content (it never pushes it), so
  // the published width is always 0 there, whether the drawer is open or not.
  useEffect(() => {
    let width = 0;
    if (!isMobile) {
      width = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    }
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);

    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
    };
  }, [isMobile, isCollapsed]);

  // Track the mobile breakpoint live; switching to mobile always starts with
  // the drawer closed.
  useEffect(() => {
    const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);

    const handleChange = (event) => {
      setIsMobile(event.matches);
      setIsMobileOpen(false);
    };

    setIsMobile(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, []);

  const handleToggleMobileOpen = useCallback(() => {
    setIsMobileOpen((value) => !value);
  }, []);

  useEffect(() => {
    openListeners.add(handleToggleMobileOpen);

    return () => {
      openListeners.delete(handleToggleMobileOpen);
    };
  }, [handleToggleMobileOpen]);

  const closeMobileDrawer = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  // Escape closes the drawer.
  useEffect(() => {
    if (!isMobile || !isMobileOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMobileDrawer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, isMobileOpen, closeMobileDrawer]);

  // Choosing a link (project, board, home, goals) closes the drawer.
  useEffect(() => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Lock page scroll behind the open drawer.
  useEffect(() => {
    if (!isMobile || !isMobileOpen) {
      return undefined;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isMobile, isMobileOpen]);

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

  const isEffectivelyCollapsed = isCollapsed && !isMobile;

  let toggleTitle;
  let toggleIconName;
  if (isMobile) {
    toggleTitle = t('common.collapseSidebar');
    toggleIconName = 'close';
  } else if (isCollapsed) {
    toggleTitle = t('common.expandSidebar');
    toggleIconName = 'sidebar';
  } else {
    toggleTitle = t('common.collapseSidebar');
    toggleIconName = 'angle double left';
  }

  return (
    <>
      {isMobile && (
        <div
          className={classNames(styles.backdrop, isMobileOpen && styles.backdropVisible)}
          onClick={closeMobileDrawer}
          aria-hidden="true"
        />
      )}
      <aside
        className={classNames(
          styles.wrapper,
          isEffectivelyCollapsed && styles.wrapperCollapsed,
          isMobile && styles.wrapperMobile,
          isMobile && isMobileOpen && styles.wrapperMobileOpen,
        )}
        aria-label={t('common.projects')}
        aria-hidden={isMobile && !isMobileOpen}
      >
        <div className={styles.top}>
          <button
            type="button"
            className={styles.toggle}
            title={toggleTitle}
            onClick={isMobile ? closeMobileDrawer : handleToggleCollapsed}
          >
            <Icon fitted name={toggleIconName} />
          </button>
          {!isEffectivelyCollapsed && (
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
            {!isEffectivelyCollapsed && (
              <span className={styles.homeLabel}>{t('common.home')}</span>
            )}
          </Link>
          <Link
            to={Paths.GOALS}
            className={classNames(styles.homeLink, isGoalsPage && styles.homeLinkActive)}
            title={t('common.goals')}
          >
            <Icon fitted name="bullseye" className={styles.homeIcon} />
            {!isEffectivelyCollapsed && (
              <span className={styles.homeLabel}>{t('common.goals')}</span>
            )}
          </Link>
          {!isEffectivelyCollapsed && (
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
            {!isEffectivelyCollapsed && (
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
              {!isEffectivelyCollapsed && <span>{t('action.createProject')}</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
});

export default Sidebar;
