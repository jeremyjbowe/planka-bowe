/*!
 * DTP fork — board menu popup wrapping CalendarFeedLinks for one board.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Popup } from '../../../lib/custom-ui';

import CalendarFeedLinks from './CalendarFeedLinks';

import styles from './CalendarFeedLinks.module.scss';

const CalendarFeedStep = React.memo(({ boardId, onBack }) => {
  const [t] = useTranslation();

  return (
    <>
      <Popup.Header onBack={onBack}>
        {t('common.calendarFeed', {
          context: 'title',
        })}
      </Popup.Header>
      <Popup.Content>
        <div className={styles.stepWrapper}>
          <p className={styles.intro}>{t('common.calendarFeedBoardIntro')}</p>
          <CalendarFeedLinks boardId={boardId} />
        </div>
      </Popup.Content>
    </>
  );
});

CalendarFeedStep.propTypes = {
  boardId: PropTypes.string.isRequired,
  onBack: PropTypes.func,
};

CalendarFeedStep.defaultProps = {
  onBack: undefined,
};

export default CalendarFeedStep;
