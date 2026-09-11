/*!
 * planka-bowe — GET /api/users/me/calendar-feed
 * The current user's feed token and URLs (created on first call).
 */

module.exports = {
  async fn() {
    const { currentUser } = this.req;

    const token = await sails.helpers.calendarFeeds.getOrCreateToken.with({
      user: currentUser,
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
