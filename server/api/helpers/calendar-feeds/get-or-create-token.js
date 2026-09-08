/*!
 * DTP fork — calendar feeds. Returns the user's feed token, minting one on
 * first use (or when `regenerate` is set, which invalidates old URLs).
 */

const crypto = require('crypto');

module.exports = {
  inputs: {
    user: {
      type: 'ref',
      required: true,
    },
    regenerate: {
      type: 'boolean',
      defaultsTo: false,
    },
  },

  async fn(inputs) {
    if (inputs.user.calendarFeedToken && !inputs.regenerate) {
      return inputs.user.calendarFeedToken;
    }

    const calendarFeedToken = crypto.randomBytes(24).toString('base64url');

    await User.qm.updateOne(inputs.user.id, {
      calendarFeedToken,
    });

    return calendarFeedToken;
  },
};
