/*!
 * DTP fork — the "Views" dropdown: shared presets first, then the personal
 * ones, plus "Save current view…". Rename and delete show on hover for the
 * views you own.
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';
import { Popup } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useSteps } from '../../../hooks';
import SavedViewFormStep from './SavedViewFormStep';
import ConfirmationStep from '../../common/ConfirmationStep';

import styles from './SavedViewsStep.module.scss';

const StepTypes = {
  ADD: 'ADD',
  RENAME: 'RENAME',
  DELETE: 'DELETE',
};

const SavedViewsStep = React.memo(({ onClose }) => {
  const savedViews = useSelector(selectors.selectSavedViewsForCurrentBoard, shallowEqual);
  const activeSavedViewId = useSelector(selectors.selectActiveSavedViewIdForCurrentBoard);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [step, openStep, handleBack] = useSteps();

  const handleSelectClick = useCallback(
    ({
      currentTarget: {
        dataset: { id },
      },
    }) => {
      dispatch(entryActions.applySavedViewInCurrentBoard(id));
      onClose();
    },
    [dispatch, onClose],
  );

  const handleRenameClick = useCallback(
    (event) => {
      event.stopPropagation();
      openStep(StepTypes.RENAME, { id: event.currentTarget.dataset.id });
    },
    [openStep],
  );

  const handleDeleteClick = useCallback(
    (event) => {
      event.stopPropagation();
      openStep(StepTypes.DELETE, { id: event.currentTarget.dataset.id });
    },
    [openStep],
  );

  const handleAddClick = useCallback(() => {
    openStep(StepTypes.ADD);
  }, [openStep]);

  const handleAddSubmit = useCallback(
    (data) => {
      dispatch(entryActions.createSavedViewInCurrentBoard(data));
    },
    [dispatch],
  );

  const handleRenameSubmit = useCallback(
    (data) => {
      dispatch(entryActions.updateSavedView(step.params.id, data));
    },
    [step, dispatch],
  );

  const handleDeleteConfirm = useCallback(() => {
    dispatch(entryActions.deleteSavedView(step.params.id));
  }, [step, dispatch]);

  if (step) {
    switch (step.type) {
      case StepTypes.ADD:
        return (
          <SavedViewFormStep
            title="common.saveCurrentView"
            buttonContent="action.save"
            onSubmit={handleAddSubmit}
            onBack={handleBack}
            onClose={onClose}
          />
        );
      case StepTypes.RENAME: {
        const savedView = savedViews.find((item) => item.id === step.params.id);

        if (!savedView) {
          return null;
        }

        return (
          <SavedViewFormStep
            title="common.editView"
            buttonContent="action.save"
            defaultData={{
              name: savedView.name,
              isShared: savedView.isShared,
            }}
            onSubmit={handleRenameSubmit}
            onBack={handleBack}
            onClose={onClose}
          />
        );
      }
      case StepTypes.DELETE:
        return (
          <ConfirmationStep
            title="common.deleteView"
            content="common.areYouSureYouWantToDeleteThisView"
            buttonContent="action.deleteView"
            onConfirm={handleDeleteConfirm}
            onBack={handleBack}
            onClose={onClose}
          />
        );
      default:
    }
  }

  return (
    <>
      <Popup.Header>{t('common.views')}</Popup.Header>
      <Popup.Content>
        <div className={styles.items}>
          {savedViews.map((savedView) => (
            <div
              key={savedView.id}
              className={classNames(
                styles.item,
                savedView.id === activeSavedViewId && styles.itemActive,
              )}
            >
              <button
                type="button"
                data-id={savedView.id}
                className={styles.itemButton}
                onClick={handleSelectClick}
              >
                <Icon
                  name={savedView.isShared ? 'users' : 'user'}
                  className={styles.itemIcon}
                  title={t(savedView.isShared ? 'common.sharedView' : 'common.personalView')}
                />
                <span className={styles.itemName}>{savedView.name}</span>
                {savedView.id === activeSavedViewId && (
                  <Icon name="check" className={styles.itemCheck} />
                )}
              </button>
              {savedView.isOwn && savedView.isPersisted && (
                <span className={styles.itemActions}>
                  <button
                    type="button"
                    data-id={savedView.id}
                    title={t('action.edit')}
                    className={styles.itemAction}
                    onClick={handleRenameClick}
                  >
                    <Icon fitted name="pencil" />
                  </button>
                  <button
                    type="button"
                    data-id={savedView.id}
                    title={t('action.delete')}
                    className={styles.itemAction}
                    onClick={handleDeleteClick}
                  >
                    <Icon fitted name="trash alternate outline" />
                  </button>
                </span>
              )}
            </div>
          ))}
          {savedViews.length === 0 && <div className={styles.empty}>{t('common.noViewsYet')}</div>}
        </div>
        <button type="button" className={styles.addButton} onClick={handleAddClick}>
          <Icon name="plus" className={styles.addButtonIcon} />
          {t('common.saveCurrentView')}
        </button>
      </Popup.Content>
    </>
  );
});

SavedViewsStep.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default SavedViewsStep;
