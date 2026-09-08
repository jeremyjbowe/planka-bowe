/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { isUserAdminOrProjectOwner } from '../../../utils/record-helpers';
import EmptyState from '../EmptyState';
import { HomeViews } from '../../../constants/Enums';
import GridProjectsView from './GridProjectsView';
import GroupedProjectsView from './GroupedProjectsView';

import styles from './Home.module.scss';

const Home = React.memo(() => {
  const view = useSelector(selectors.selectHomeView);
  const hasProjects = useSelector(
    (state) => (selectors.selectProjectIdsForCurrentUser(state) || []).length > 0,
  );
  const hasFilteredProjects = useSelector(
    (state) => (selectors.selectFilteredProjectIdsForCurrentUser(state) || []).length > 0,
  );
  const canAdd = useSelector((state) =>
    isUserAdminOrProjectOwner(selectors.selectCurrentUser(state)),
  );

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleAddClick = useCallback(() => {
    dispatch(entryActions.openAddProjectModal());
  }, [dispatch]);

  if (!hasProjects) {
    return (
      <div className={styles.wrapper}>
        <EmptyState
          size="large"
          icon="folder open outline"
          title={t('common.noProjectsYet')}
          hint={canAdd ? t('common.noProjectsHintOwner') : t('common.noProjectsHintMember')}
        >
          {canAdd && (
            <Button positive size="large" onClick={handleAddClick}>
              <Icon name="plus" />
              {t('action.createProject')}
            </Button>
          )}
        </EmptyState>
      </div>
    );
  }

  if (!hasFilteredProjects) {
    return (
      <div className={styles.wrapper}>
        <EmptyState
          icon="search"
          title={t('common.noProjectsMatch')}
          hint={t('common.noProjectsMatchHint')}
        />
      </div>
    );
  }

  let View;
  switch (view) {
    case HomeViews.GRID_PROJECTS:
      View = GridProjectsView;

      break;
    case HomeViews.GROUPED_PROJECTS:
      View = GroupedProjectsView;

      break;
    default:
  }

  return (
    <div className={styles.wrapper}>
      <View />
    </div>
  );
});

export default Home;
