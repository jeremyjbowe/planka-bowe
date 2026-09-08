/*
 * Seeds a running Planka instance with a realistic demo workspace through the
 * public REST API. Safe to run against a fresh dev database only.
 *
 * Usage: node scripts/seed-demo-data.mjs [baseUrl] [username] [password]
 */

const BASE_URL = process.argv[2] || 'http://localhost:1337';
const USERNAME = process.argv[3] || 'demo';
const PASSWORD = process.argv[4] || 'demo';

let token;

const api = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
};

const daysFromNow = (days, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const main = async () => {
  ({ item: token } = await api('POST', '/access-tokens', {
    emailOrUsername: USERNAME,
    password: PASSWORD,
  }));

  // Teammate used by the Quick Add acceptance test ("@jeremy").
  let jeremy;
  try {
    ({ item: jeremy } = await api('POST', '/users', {
      email: 'jeremy@example.com',
      password: 'jeremy-demo-1234',
      name: 'Jeremy Park',
      username: 'jeremy',
      role: 'boardUser',
    }));
  } catch (error) {
    const { items } = await api('GET', '/users');
    jeremy = items.find((user) => user.username === 'jeremy');
  }

  const { item: project } = await api('POST', '/projects', {
    type: 'shared',
    name: 'Product Launch',
    description: 'Everything needed to ship v1 to customers.',
  });

  const { item: board } = await api('POST', `/projects/${project.id}/boards`, {
    position: 65536,
    name: 'Roadmap',
  });

  await api('POST', `/boards/${board.id}/board-memberships`, {
    userId: jeremy.id,
    role: 'editor',
  });

  const listSpecs = [
    ['Backlog', 'active'],
    ['In Progress', 'active'],
    ['Review', 'active'],
    ['Done', 'closed'],
  ];

  const lists = [];
  for (const [index, [name, type]] of listSpecs.entries()) {
    const { item } = await api('POST', `/boards/${board.id}/lists`, {
      type,
      position: (index + 1) * 65536,
      name,
    });
    lists.push(item);
  }

  const labelSpecs = [
    ['billing', 'pumpkin-orange'],
    ['design', 'lagoon-blue'],
    ['backend', 'midnight-blue'],
    ['bug', 'berry-red'],
  ];

  const labels = {};
  for (const [index, [name, color]] of labelSpecs.entries()) {
    const { item } = await api('POST', `/boards/${board.id}/labels`, {
      position: (index + 1) * 65536,
      name,
      color,
    });
    labels[name] = item;
  }

  const { item: me } = await api('GET', '/users/me');

  const cardSpecs = [
    { list: 0, name: 'Write launch announcement', due: 3, labels: ['design'], members: [me] },
    { list: 0, name: 'Set up Stripe webhooks', due: 5, labels: ['billing', 'backend'], members: [jeremy] },
    { list: 0, name: 'Design pricing page', due: 7, labels: ['design'], members: [] },
    { list: 1, name: 'Migrate invoices table', due: 1, labels: ['billing', 'backend'], members: [jeremy, me] },
    { list: 1, name: 'Fix onboarding crash on Safari', due: 0, labels: ['bug'], members: [me] },
    { list: 2, name: 'Review API rate limiting', due: 2, labels: ['backend'], members: [jeremy] },
    { list: 3, name: 'Choose launch date', due: -4, labels: [], members: [me] },
    { list: 3, name: 'Draft press kit', due: -2, labels: ['design'], members: [] },
    { list: 0, name: 'Plan customer webinar', due: null, labels: [], members: [] },
  ];

  for (const [index, spec] of cardSpecs.entries()) {
    const { item: card } = await api('POST', `/lists/${lists[spec.list].id}/cards`, {
      type: 'project',
      position: (index + 1) * 65536,
      name: spec.name,
      description: `Demo card #${index + 1} for the ${lists[spec.list].name} list.`,
      ...(spec.due === null ? {} : { dueDate: daysFromNow(spec.due) }),
    });

    for (const labelName of spec.labels) {
      await api('POST', `/cards/${card.id}/card-labels`, { labelId: labels[labelName].id });
    }

    for (const member of spec.members) {
      await api('POST', `/cards/${card.id}/card-memberships`, { userId: member.id });
    }
  }

  console.log(`Seeded project ${project.id} / board ${board.id} at ${BASE_URL}`);
  console.log(`Board URL: http://localhost:3000/boards/${board.id}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
