/*!
 * planka-bowe — CalendarFeedLinks.
 *
 * Shows the subscribe/download URLs of the current user's iCalendar feed,
 * either the personal "my cards" feed or one board's feed. The feed token is
 * fetched on demand (and minted server-side on first use); it never lives in
 * the Redux store.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Loader } from 'semantic-ui-react';

import api from '../../../api';
import { getAccessToken } from '../../../utils/access-token-storage';

import styles from './CalendarFeedLinks.module.scss';

const Modes = {
  TODOS: 'todos',
  EVENTS: 'events',
};

const authHeaders = () => ({
  Authorization: `Bearer ${getAccessToken()}`,
});

const buildUrls = (feed, boardId) => {
  const base = boardId
    ? `${feed.baseUrl}/feeds/${feed.token}/boards/${boardId}/todos.ics`
    : feed.todosUrl;

  return {
    [Modes.TODOS]: base,
    [Modes.EVENTS]: `${base}?mode=events`,
  };
};

const CalendarFeedLinks = React.memo(({ boardId, withRegenerate }) => {
  const [t] = useTranslation();
  const [feed, setFeed] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState(Modes.TODOS);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    let isActive = true;

    api
      .getCurrentUserCalendarFeed(authHeaders())
      .then(({ item }) => {
        if (isActive) {
          setFeed(item);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const urls = useMemo(() => (feed ? buildUrls(feed, boardId) : null), [feed, boardId]);
  const url = urls ? urls[mode] : '';
  const webcalUrl = url.replace(/^https?:\/\//, 'webcal://');

  const handleCopyClick = useCallback(() => {
    if (!url) {
      return;
    }

    const done = () => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      done();
    }
  }, [url]);

  const handleRegenerateClick = useCallback(() => {
    setIsLoading(true);

    api
      .regenerateCurrentUserCalendarFeed(authHeaders())
      .then(({ item }) => setFeed(item))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading && !feed) {
    return <Loader active inline="centered" size="small" />;
  }

  if (!feed) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.modes}>
        {Object.values(Modes).map((value) => (
          <button
            key={value}
            type="button"
            className={classNames(styles.mode, mode === value && styles.modeActive)}
            onClick={() => setMode(value)}
          >
            <Icon
              name={value === Modes.TODOS ? 'check square outline' : 'calendar alternate outline'}
            />
            {value === Modes.TODOS
              ? t('common.calendarFeedModeTodos')
              : t('common.calendarFeedModeEvents')}
          </button>
        ))}
      </div>
      <p className={styles.hint}>{t('common.calendarFeedModeHint')}</p>

      <div className={styles.label}>{t('common.calendarFeedSubscribeUrl')}</div>
      <div className={styles.urlRow}>
        <input
          readOnly
          value={url}
          className={styles.url}
          onFocus={(event) => event.target.select()}
        />
        <Button type="button" className={styles.copyButton} onClick={handleCopyClick}>
          <Icon name={isCopied ? 'check' : 'copy outline'} />
          {isCopied ? t('common.copied') : t('common.copyLink')}
        </Button>
      </div>

      <div className={styles.actions}>
        <a href={webcalUrl} className={styles.actionLink}>
          <Icon name="external alternate" />
          {t('common.openInCalendarApp')}
        </a>
        <a href={url} download target="_blank" rel="noreferrer" className={styles.actionLink}>
          <Icon name="download" />
          {t('common.calendarFeedDownload')}
        </a>
        {withRegenerate && (
          <button
            type="button"
            disabled={isLoading}
            className={classNames(styles.actionLink, styles.actionDanger)}
            title={t('common.calendarFeedRegenerateHint')}
            onClick={handleRegenerateClick}
          >
            <Icon name="redo" />
            {t('common.calendarFeedRegenerate')}
          </button>
        )}
      </div>
      {withRegenerate && <p className={styles.hint}>{t('common.calendarFeedRegenerateHint')}</p>}
    </div>
  );
});

CalendarFeedLinks.propTypes = {
  boardId: PropTypes.string,
  withRegenerate: PropTypes.bool,
};

CalendarFeedLinks.defaultProps = {
  boardId: undefined,
  withRegenerate: false,
};

export default CalendarFeedLinks;
