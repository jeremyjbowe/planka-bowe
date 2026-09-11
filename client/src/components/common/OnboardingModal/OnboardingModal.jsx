/*!
 * planka-bowe — OnboardingModal.
 *
 * Thirty-second first run: a user who can create projects but has none yet
 * names a workspace, picks a list template and lands on a ready-to-use board.
 * Everything is created through the regular sagas (project → board → lists)
 * so real-time sync and permissions behave exactly as for manual creation.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import Config from '../../../constants/Config';
import { ListTypes } from '../../../constants/Enums';
import { isUserAdminOrProjectOwner } from '../../../utils/record-helpers';

import styles from './OnboardingModal.module.scss';

const TEMPLATES = [
  {
    key: 'simple',
    icon: 'columns',
    labelKey: 'common.onboardingTemplateSimple',
    lists: [
      { name: 'To do', type: ListTypes.ACTIVE },
      { name: 'Doing', type: ListTypes.ACTIVE },
      { name: 'Done', type: ListTypes.CLOSED },
    ],
  },
  {
    key: 'sprint',
    icon: 'rocket',
    labelKey: 'common.onboardingTemplateSprint',
    lists: [
      { name: 'Backlog', type: ListTypes.ACTIVE },
      { name: 'This week', type: ListTypes.ACTIVE },
      { name: 'In progress', type: ListTypes.ACTIVE },
      { name: 'Review', type: ListTypes.ACTIVE },
      { name: 'Done', type: ListTypes.CLOSED },
    ],
  },
  {
    key: 'personal',
    icon: 'coffee',
    labelKey: 'common.onboardingTemplatePersonal',
    lists: [
      { name: 'Inbox', type: ListTypes.ACTIVE },
      { name: 'Today', type: ListTypes.ACTIVE },
      { name: 'Someday', type: ListTypes.ACTIVE },
      { name: 'Done', type: ListTypes.CLOSED },
    ],
  },
];

const dismissKey = (userId) => `bowe_onboardingDismissed_${userId}`;

const readDismissed = (userId) => {
  try {
    return localStorage.getItem(dismissKey(userId)) === 'true';
  } catch {
    return false;
  }
};

const writeDismissed = (userId) => {
  try {
    localStorage.setItem(dismissKey(userId), 'true');
  } catch {
    // Storage may be unavailable; the modal simply shows again next time.
  }
};

const OnboardingModal = React.memo(() => {
  const user = useSelector(selectors.selectCurrentUser);
  const hasProjects = useSelector(
    (state) => (selectors.selectProjectIdsForCurrentUser(state) || []).length > 0,
  );

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const [isDismissed, setIsDismissed] = useState(() => (user ? readDismissed(user.id) : true));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [boardName, setBoardName] = useState('');
  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key);
  const inputRef = useRef(null);

  const isVisible = !!user && !hasProjects && !isDismissed && isUserAdminOrProjectOwner(user);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const template = useMemo(
    () => TEMPLATES.find((item) => item.key === templateKey) || TEMPLATES[0],
    [templateKey],
  );

  const handleDismiss = useCallback(() => {
    writeDismissed(user.id);
    setIsDismissed(true);
  }, [user]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      writeDismissed(user.id);

      dispatch(
        entryActions.bootstrapWorkspace({
          projectName: projectName.trim() || t('common.onboardingDefaultProjectName'),
          boardName: boardName.trim() || t('common.onboardingDefaultBoardName'),
          lists: template.lists,
        }),
      );
    },
    [isSubmitting, user, projectName, boardName, template, dispatch, t],
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.eyebrow}>{t('common.onboardingEyebrow')}</div>
        <h1 className={styles.title}>
          {t('common.onboardingTitle', { name: user.name.split(' ')[0] })}
        </h1>
        <p className={styles.subtitle}>{t('common.onboardingSubtitle')}</p>

        <label className={styles.label} htmlFor="onboarding-project-name">
          {t('common.onboardingProjectName')}
        </label>
        <input
          ref={inputRef}
          id="onboarding-project-name"
          value={projectName}
          placeholder={t('common.onboardingDefaultProjectName')}
          maxLength={128}
          className={styles.input}
          onChange={(event) => setProjectName(event.target.value)}
        />

        <label className={styles.label} htmlFor="onboarding-board-name">
          {t('common.onboardingBoardName')}
        </label>
        <input
          id="onboarding-board-name"
          value={boardName}
          placeholder={t('common.onboardingDefaultBoardName')}
          maxLength={128}
          className={styles.input}
          onChange={(event) => setBoardName(event.target.value)}
        />

        <div className={styles.label}>{t('common.onboardingTemplate')}</div>
        <div className={styles.templates}>
          {TEMPLATES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={classNames(
                styles.template,
                item.key === templateKey && styles.templateActive,
              )}
              onClick={() => setTemplateKey(item.key)}
            >
              <Icon name={item.icon} className={styles.templateIcon} />
              <span className={styles.templateName}>{t(item.labelKey)}</span>
              <span className={styles.templateLists}>
                {item.lists.map((list) => list.name).join(' · ')}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.footer}>
          <Button
            positive
            type="submit"
            size="large"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {t('common.onboardingCreate')}
          </Button>
          <button type="button" className={styles.skip} onClick={handleDismiss}>
            {t('common.onboardingSkip')}
          </button>
          <span className={styles.tip}>
            <kbd className={styles.kbd}>{Config.IS_MAC ? '⌘' : 'Ctrl'} K</kbd>
            {t('common.onboardingTip')}
          </span>
        </div>
      </form>
    </div>
  );
});

export default OnboardingModal;
