const apiPort = Number(process.env.API_PORT ?? '4000');
import { createApp } from './app.js';

const app = createApp({ apiPort });

app.listen(apiPort, () => {
  console.log(`Local API listening on http://localhost:${apiPort}`);
});