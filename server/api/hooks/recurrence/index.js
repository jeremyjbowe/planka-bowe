/*!
 * DTP fork — recurrence hook.
 *
 * Background job that turns completed recurring cards into their next
 * occurrence. `helpers/cards/update-one` also calls the spawner inline when a
 * card closes, so the UI feels instant; this interval is the safety net for
 * anything that closed while the server was down or through a bulk update.
 * Both paths share the same atomic claim, so running them together is safe.
 */

const INTERVAL_MS = 60 * 1000;

module.exports = function defineRecurrenceHook(sails) {
  let isRunning = false;

  const spawnPendingOccurrences = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const cards = await Card.qm.getPendingRecurrences();

      // eslint-disable-next-line no-restricted-syntax
      for (const card of cards) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await sails.helpers.cards.spawnNextOccurrence.with({
            record: card,
          });
        } catch (error) {
          sails.log.error(`Recurrence: could not spawn next occurrence of card ${card.id}`, error);
        }
      }
    } catch (error) {
      sails.log.warn(`Recurrence: could not load pending cards (${error.message})`);
    } finally {
      isRunning = false;
    }
  };

  return {
    /**
     * Runs when this Sails app loads/lifts.
     */

    async initialize() {
      sails.log.info('Initializing custom hook (`recurrence`)');

      // The test environment runs on sails-disk and lifts/lowers quickly;
      // there is nothing to spawn there.
      if (sails.config.environment === 'test') {
        return;
      }

      let timeout;
      let interval;

      sails.after('hook:orm:loaded', () => {
        timeout = setTimeout(spawnPendingOccurrences, 5 * 1000);
        interval = setInterval(spawnPendingOccurrences, INTERVAL_MS);
      });

      sails.on('lower', () => {
        clearTimeout(timeout);
        clearInterval(interval);
      });
    },
  };
};
