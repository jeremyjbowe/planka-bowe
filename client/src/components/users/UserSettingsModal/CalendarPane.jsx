/*!
 * DTP fork — user settings → Calendar: the personal iCalendar feed.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, Header, Tab } from 'semantic-ui-react';

import CalendarFeedLinks from '../../common/CalendarFeedLinks';

import styles from './CalendarPane.module.scss';

const CalendarPane = React.memo(() => {
  const [t] = useTranslation();

  return (
    <Tab.Pane attached={false} className={styles.wrapper}>
      <p className={styles.intro}>{t('common.calendarFeedIntro')}</p>
      <Divider horizontal section>
        <Header as="h4">{t('common.calendarFeedPersonal')}</Header>
      </Divider>
      <p className={styles.intro}>{t('common.calendarFeedPersonalHint')}</p>
      <CalendarFeedLinks withRegenerate />
    </Tab.Pane>
  );
});

export default CalendarPane;
