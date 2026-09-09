import { Client } from "pg";

function createScriptClient(connectionString: string): Client {
  return new Client({ connectionString });
}

export { createScriptClient };
