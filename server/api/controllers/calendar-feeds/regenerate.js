/*!
 * planka-bowe — POST /api/users/me/calendar-feed/regenerate
 * Mints a new token; previously shared feed URLs stop working.
 */

module.exports = {
  async fn() {
    const { currentUser } = this.req;

    const token = await sails.helpers.calendarFeeds.getOrCreateToken.with({
      user: currentUser,
      regenerate: true,
    });

    return {
      item: {
        token,
        baseUrl: sails.config.custom.baseUrl,
        ...sails.helpers.calendarFeeds.buildFeedUrls(token),
      },
    };
  },
};
