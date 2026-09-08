/*!
 * DTP fork — GET /api/goals
 * Every goal with its links, the link targets the user may see, and owners.
 */

module.exports = {
  async fn() {
    const { currentUser } = this.req;

    const goals = await Goal.qm.getAll();
    const goalLinks = await GoalLink.qm.getByGoalIds(sails.helpers.utils.mapRecords(goals));

    const summaries = await sails.helpers.goals.buildLinkSummaries.with({
      goalLinks,
      user: currentUser,
    });

    const userIds = sails.helpers.utils.mapRecords(goals, 'ownerUserId', true, true);
    const users = await User.qm.getByIds(userIds);

    return {
      items: goals,
      included: {
        goalLinks,
        cards: summaries.cards,
        boards: summaries.boards,
        users: sails.helpers.users.presentMany(users, currentUser),
      },
    };
  },
};
