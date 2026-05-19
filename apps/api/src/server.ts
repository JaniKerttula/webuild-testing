import { createApp } from './app.js';

// Support both PORT (Azure) and API_PORT (local development)
const apiPort = Number(process.env.PORT ?? process.env.API_PORT ?? '4000');
const app = createApp({ apiPort });

app.listen(apiPort, () => {
  console.log(`API listening on port ${apiPort}`);
});