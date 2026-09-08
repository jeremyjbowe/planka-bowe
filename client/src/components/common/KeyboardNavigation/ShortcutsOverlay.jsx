/*!
 * DTP fork — the `?` cheat sheet.
 *
 * Pure presentation: every binding implemented in KeyboardNavigation.jsx (and
 * the board's hover shortcuts in boards/Board/ShortcutsProvider.jsx) is listed
 * here. Keep the two files in sync — a binding nobody can discover is a
 * binding nobody uses.
 *
 * A row's `keys` is a list of alternatives; each alternative is a list of keys
 * pressed one after another ("g" then "h"). Closing is handled by the key
 * handler (Escape / `?`) and by the backdrop and the close button here.
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import Config from '../../../constants/Config';

import styles from './ShortcutsOverlay.module.scss';

const MODIFIER_KEY = Config.IS_MAC ? '⌘' : 'Ctrl';

const GROUPS = [
  {
    titleKey: 'common.shortcutsNavigation',
    items: [
      { keys: [['j']], labelKey: 'common.shortcutSelectNextCard' },
      { keys: [['k']], labelKey: 'common.shortcutSelectPreviousCard' },
      { keys: [['h']], labelKey: 'common.shortcutSelectPreviousList' },
      { keys: [['l']], labelKey: 'common.shortcutSelectNextList' },
      { keys: [['↵'], ['o']], labelKey: 'common.shortcutOpenSelectedCard' },
      { keys: [['esc']], labelKey: 'common.shortcutClearSelection' },
    ],
  },
  {
    titleKey: 'common.shortcutsCards',
    items: [
      { keys: [['n']], labelKey: 'common.shortcutAddCard' },
      { keys: [['e']], labelKey: 'common.shortcutOpenHoveredCard' },
      { keys: [['t']], labelKey: 'common.shortcutEditCardName' },
      { keys: [['m']], labelKey: 'common.shortcutCardMembers' },
      { keys: [['l']], labelKey: 'common.shortcutCardLabels' },
      { keys: [['v']], labelKey: 'common.shortcutArchiveCard' },
      { keys: [['1', '…', '9']], labelKey: 'common.shortcutToggleLabel' },
      { keys: [[MODIFIER_KEY, 'C']], labelKey: 'common.shortcutCopyCard' },
      { keys: [[MODIFIER_KEY, 'X']], labelKey: 'common.shortcutCutCard' },
      { keys: [[MODIFIER_KEY, 'V']], labelKey: 'common.shortcutPasteCard' },
    ],
  },
  {
    titleKey: 'common.shortcutsViews',
    items: [
      { keys: [['1']], labelKey: 'common.kanban' },
      { keys: [['2']], labelKey: 'common.grid' },
      { keys: [['3']], labelKey: 'common.list' },
      { keys: [['4']], labelKey: 'common.table' },
      { keys: [['5']], labelKey: 'common.timeline' },
    ],
  },
  {
    titleKey: 'common.shortcutsBoard',
    items: [
      { keys: [['/']], labelKey: 'common.shortcutSearchBoard' },
      { keys: [['[']], labelKey: 'common.shortcutPreviousBoard' },
      { keys: [[']']], labelKey: 'common.shortcutNextBoard' },
    ],
  },
  {
    titleKey: 'common.shortcutsGlobal',
    items: [
      { keys: [[MODIFIER_KEY, 'K']], labelKey: 'common.shortcutCommandPalette' },
      { keys: [['?']], labelKey: 'common.shortcutToggleShortcuts' },
      { keys: [['g', 'h']], labelKey: 'common.shortcutGoHome' },
      { keys: [['g', 'g']], labelKey: 'common.shortcutGoToGoals' },
      { keys: [['g', '1', '…', '9']], labelKey: 'common.shortcutGoToBoard' },
    ],
  },
];

const ShortcutsOverlay = React.memo(({ onClose }) => {
  const [t] = useTranslation();

  // Only a press on the backdrop itself closes the overlay.
  const handleOverlayMouseDown = useCallback(
    (event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={styles.overlay} onMouseDown={handleOverlayMouseDown}>
      <div className={styles.panel} role="dialog" aria-label={t('common.keyboardShortcuts')}>
        <div className={styles.header}>
          <Icon name="keyboard outline" className={styles.headerIcon} />
          <span className={styles.headerTitle}>{t('common.keyboardShortcuts')}</span>
          <Button
            icon="close"
            aria-label={t('common.keyboardShortcuts')}
            className={styles.closeButton}
            onClick={onClose}
          />
        </div>
        <div className={styles.groups}>
          {GROUPS.map((group) => (
            <section key={group.titleKey} className={styles.group}>
              <h3 className={styles.groupTitle}>{t(group.titleKey)}</h3>
              {group.items.map((item) => (
                <div key={item.labelKey} className={styles.item}>
                  <span className={styles.itemLabel}>{t(item.labelKey)}</span>
                  <span className={styles.itemKeys}>
                    {item.keys.map((alternative, index) => (
                      <React.Fragment key={alternative.join('+')}>
                        {index > 0 && <span className={styles.separator}>/</span>}
                        {alternative.map((key, keyIndex) =>
                          key === '…' ? (
                            // eslint-disable-next-line react/no-array-index-key
                            <span key={keyIndex} className={styles.separator}>
                              …
                            </span>
                          ) : (
                            // eslint-disable-next-line react/no-array-index-key
                            <kbd key={keyIndex} className={styles.kbd}>
                              {key}
                            </kbd>
                          ),
                        )}
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className={styles.footer}>
          <span>{t('common.shortcutsHoverHint')}</span>
          <span className={styles.footerKeys}>
            <kbd className={styles.kbd}>?</kbd>
            <kbd className={styles.kbd}>esc</kbd>
          </span>
        </div>
      </div>
    </div>
  );
});

ShortcutsOverlay.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default ShortcutsOverlay;
